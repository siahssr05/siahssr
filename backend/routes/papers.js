const express = require("express");
const path = require("path");
const fs = require("fs");
const rateLimit = require("express-rate-limit");
const pool = require("../config/db");
const { requireAuth, requireRole, optionalAuth } = require("../middleware/auth");
const { uploadPaper } = require("../utils/upload");
const { generateSubmissionReceipt, generatePublicationCertificate } = require("../utils/receiptGenerator");
const { sendMail } = require("../utils/mailer");
const { verifyCaptcha } = require("../utils/captcha");

const router = express.Router();

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: "Too many submissions from this connection. Please try again later." },
});

const STATUS_EMAIL_TEXT = {
  under_review: "Your submission has moved to Under Review.",
  accepted: "Congratulations — your submission has been Accepted.",
  rejected: "Your submission was not accepted for publication this time.",
};

// ---------- SUBMIT A PAPER (author) ----------
router.post(
  "/",
  submitLimiter,
  requireAuth,
  requireRole("author"),
  uploadPaper.single("file"),
  async (req, res) => {
    try {
      const { title, abstract, keywords, journal_id, captchaToken, captchaAnswer } = req.body;
      if (!title || !abstract || !journal_id || !req.file) {
        return res.status(400).json({ error: "Title, abstract, journal and Word (.docx) file are required" });
      }
      if (!verifyCaptcha(captchaToken, captchaAnswer)) {
        // multer already wrote the upload to disk before we could check the
        // captcha (multipart fields only become available once the whole
        // request, file included, has been parsed) — clean it up rather than
        // leaving an orphaned file behind.
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: "Captcha answer is incorrect or expired. Please try again." });
      }

      const relativeFilePath = `/uploads/papers/${req.file.filename}`;

      const [result] = await pool.query(
        `INSERT INTO papers (title, abstract, keywords, author_id, journal_id, file_path, original_filename, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted')`,
        [title, abstract, keywords || null, req.user.id, journal_id, relativeFilePath, req.file.originalname]
      );

      const paperId = result.insertId;

      // Build the submission receipt as a .docx (journal name header, page numbers on
      // every page via live Word fields) — no PDFs anywhere in this system.
      const [[journal]] = await pool.query("SELECT * FROM journals WHERE id = ?", [journal_id]);
      const [[paperRow]] = await pool.query("SELECT * FROM papers WHERE id = ?", [paperId]);

      const receiptDir = path.join(__dirname, "..", "uploads", "receipts");
      if (!fs.existsSync(receiptDir)) fs.mkdirSync(receiptDir, { recursive: true });
      const receiptFilename = `receipt-${paperId}.docx`;
      const receiptAbsPath = path.join(receiptDir, receiptFilename);

      await generateSubmissionReceipt({
        paper: paperRow,
        author: { name: req.user.name, email: req.user.email, affiliation: req.body.affiliation || "" },
        journal,
        outputPath: receiptAbsPath,
      });

      const receiptRelPath = `/uploads/receipts/${receiptFilename}`;
      await pool.query("UPDATE papers SET receipt_path = ? WHERE id = ?", [receiptRelPath, paperId]);

      res.status(201).json({
        message: "Paper submitted successfully",
        paperId,
        receiptUrl: `/api/papers/${paperId}/receipt`,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message || "Failed to submit paper" });
    }
  }
);

// ---------- PUBLIC: PUBLISHED PAPERS ARCHIVE ----------
router.get("/", async (req, res) => {
  try {
    const { journal_id, search } = req.query;
    let sql = `
      SELECT p.id, p.title, p.abstract, p.keywords, p.volume, p.issue, p.doi, p.published_at,
             COALESCE(u.name, p.author_name) AS author_name, j.name AS journal_name, j.short_name
      FROM papers p
      LEFT JOIN users u ON p.author_id = u.id
      JOIN journals j ON p.journal_id = j.id
      WHERE p.status = 'published'
    `;
    const params = [];
    if (journal_id) {
      sql += " AND j.id = ?";
      params.push(journal_id);
    }
    if (search) {
      sql += " AND (p.title LIKE ? OR p.keywords LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }
    sql += " ORDER BY p.published_at DESC";

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load papers" });
  }
});

// ---------- AUTHOR: MY SUBMISSIONS ----------
router.get("/mine", requireAuth, requireRole("author"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, j.name AS journal_name, j.short_name
       FROM papers p JOIN journals j ON p.journal_id = j.id
       WHERE p.author_id = ? ORDER BY p.submitted_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load your submissions" });
  }
});

// ---------- REVIEWER: ASSIGNED PAPERS ----------
router.get("/assigned", requireAuth, requireRole("reviewer"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, j.name AS journal_name
       FROM papers p JOIN journals j ON p.journal_id = j.id
       WHERE p.reviewer_id = ? ORDER BY p.submitted_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load assigned papers" });
  }
});

// ---------- GET SINGLE PAPER (public if published, else owner/reviewer/admin only) ----------
router.get("/:id", async (req, res) => {
  try {
    const [[paper]] = await pool.query(
      `SELECT p.*, COALESCE(u.name, p.author_name) AS author_name, COALESCE(u.email, p.author_email) AS author_email,
              j.name AS journal_name, j.short_name
       FROM papers p LEFT JOIN users u ON p.author_id = u.id JOIN journals j ON p.journal_id = j.id
       WHERE p.id = ?`,
      [req.params.id]
    );
    if (!paper) return res.status(404).json({ error: "Paper not found" });
    if (paper.status !== "published") {
      return res.status(403).json({ error: "This paper is not yet public" });
    }
    res.json(paper);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load paper" });
  }
});

// ---------- DOWNLOAD PAPER FILE (access-controlled) ----------
// Published papers are downloadable by anyone, signed in or not — the paper's
// own detail page (paper-detail.html) is public and links straight here, so
// this can't hard-require a login the way an author/reviewer-only route
// would. optionalAuth fills in req.user when a valid session is present
// (needed below for the owner/reviewer/admin checks on a NON-published
// paper) but, unlike requireAuth, doesn't reject a signed-out visitor
// outright — that used to be exactly why a guest clicking "Download Paper"
// on a published paper got "Not authenticated" here.
router.get("/:id/download", optionalAuth, async (req, res) => {
  try {
    const [[paper]] = await pool.query("SELECT * FROM papers WHERE id = ?", [req.params.id]);
    if (!paper) return res.status(404).json({ error: "Paper not found" });

    const isOwner = !!req.user && paper.author_id === req.user.id;
    const isReviewer = !!req.user && paper.reviewer_id === req.user.id;
    const isAdmin = !!req.user && req.user.role === "admin";
    const isPublic = paper.status === "published";

    if (!isPublic && !isOwner && !isReviewer && !isAdmin) {
      return res.status(403).json({ error: "You don't have access to this file" });
    }

    // A paper added through the admin "manual add" form can be created
    // without a file attached (the file input there is optional) — guard
    // against that instead of throwing on paper.file_path.replace(null).
    if (!paper.file_path) return res.status(404).json({ error: "No file is attached to this paper" });

    const absPath = path.join(__dirname, "..", paper.file_path.replace(/^\/+/, ""));
    if (!fs.existsSync(absPath)) return res.status(404).json({ error: "File not found on server" });

    res.download(absPath, paper.original_filename || "paper.docx");
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to download file" });
  }
});

// ---------- DOWNLOAD SUBMISSION RECEIPT (owner/admin) ----------
router.get("/:id/receipt", requireAuth, async (req, res) => {
  try {
    const [[paper]] = await pool.query("SELECT * FROM papers WHERE id = ?", [req.params.id]);
    if (!paper) return res.status(404).json({ error: "Paper not found" });

    const isOwner = paper.author_id === req.user.id;
    if (!isOwner && req.user.role !== "admin") {
      return res.status(403).json({ error: "You don't have access to this receipt" });
    }
    if (!paper.receipt_path) return res.status(404).json({ error: "Receipt not generated yet" });

    const absPath = path.join(__dirname, "..", paper.receipt_path.replace(/^\/+/, ""));
    if (!fs.existsSync(absPath)) return res.status(404).json({ error: "Receipt file not found" });

    res.download(absPath, `submission-receipt-${paper.id}.docx`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to download receipt" });
  }
});

// ---------- DOWNLOAD CERTIFICATE OF PUBLICATION (owner/admin, published only) ----------
// Generated fresh as a .docx on every request (cheap — a few short paragraphs), so it
// always reflects the paper's current volume/issue/DOI rather than a stale snapshot.
router.get("/:id/certificate", requireAuth, async (req, res) => {
  try {
    const [[paper]] = await pool.query(
      `SELECT p.*, COALESCE(u.name, p.author_name) AS author_name,
              COALESCE(u.affiliation, p.author_institute) AS author_affiliation,
              j.name AS journal_name, j.short_name, j.issn
       FROM papers p
       LEFT JOIN users u ON p.author_id = u.id
       JOIN journals j ON p.journal_id = j.id
       WHERE p.id = ?`,
      [req.params.id]
    );
    if (!paper) return res.status(404).json({ error: "Paper not found" });

    const isOwner = paper.author_id === req.user.id;
    if (!isOwner && req.user.role !== "admin") {
      return res.status(403).json({ error: "You don't have access to this certificate" });
    }
    if (paper.status !== "published") {
      return res.status(400).json({ error: "A certificate is only available once a paper is published" });
    }

    const certDir = path.join(__dirname, "..", "uploads", "receipts");
    if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true });
    const certAbsPath = path.join(certDir, `certificate-${paper.id}.docx`);

    await generatePublicationCertificate({
      paper,
      author: { name: paper.author_name, affiliation: paper.author_affiliation || "" },
      journal: { name: paper.journal_name, short_name: paper.short_name, issn: paper.issn },
      outputPath: certAbsPath,
    });

    res.download(certAbsPath, `certificate-of-publication-${paper.id}.docx`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate certificate" });
  }
});

// ---------- CITATION EXPORT (BibTeX / RIS) — published papers only ----------
router.get("/:id/citation", async (req, res) => {
  try {
    const format = (req.query.format || "bibtex").toLowerCase();
    const [[paper]] = await pool.query(
      `SELECT p.*, COALESCE(u.name, p.author_name) AS author_name, j.name AS journal_name, j.short_name, j.issn
       FROM papers p LEFT JOIN users u ON p.author_id = u.id JOIN journals j ON p.journal_id = j.id
       WHERE p.id = ?`,
      [req.params.id]
    );
    if (!paper || paper.status !== "published") {
      return res.status(404).json({ error: "Paper not found" });
    }

    const year = paper.published_at ? new Date(paper.published_at).getFullYear() : "";
    const firstAuthorSurname = (paper.author_name || "author").trim().split(" ").pop().toLowerCase();
    const citeKey = `${firstAuthorSurname}${year}${paper.short_name}`.replace(/[^a-z0-9]/gi, "");

    if (format === "ris") {
      const lines = [
        "TY  - JOUR",
        `TI  - ${paper.title}`,
        `AU  - ${paper.author_name}`,
        `T2  - ${paper.journal_name}`,
        paper.volume ? `VL  - ${paper.volume}` : null,
        paper.issue ? `IS  - ${paper.issue}` : null,
        year ? `PY  - ${year}` : null,
        paper.doi ? `DO  - ${paper.doi}` : null,
        paper.issn ? `SN  - ${paper.issn}` : null,
        paper.abstract ? `AB  - ${paper.abstract}` : null,
        "ER  - ",
      ].filter(Boolean);
      res.setHeader("Content-Type", "application/x-research-info-systems");
      res.setHeader("Content-Disposition", `attachment; filename="paper-${paper.id}.ris"`);
      return res.send(lines.join("\n"));
    }

    // Default: BibTeX
    const bibtex = [
      `@article{${citeKey},`,
      `  title   = {${paper.title}},`,
      `  author  = {${paper.author_name}},`,
      `  journal = {${paper.journal_name}},`,
      paper.volume ? `  volume  = {${paper.volume}},` : null,
      paper.issue ? `  number  = {${paper.issue}},` : null,
      year ? `  year    = {${year}},` : null,
      paper.doi ? `  doi     = {${paper.doi}},` : null,
      paper.issn ? `  issn    = {${paper.issn}},` : null,
      "}",
    ].filter(Boolean);
    res.setHeader("Content-Type", "application/x-bibtex");
    res.setHeader("Content-Disposition", `attachment; filename="paper-${paper.id}.bib"`);
    res.send(bibtex.join("\n"));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate citation" });
  }
});

// ---------- AUTHOR: EDIT A SUBMISSION (only while still 'submitted', owner only) ----------
router.put("/:id", requireAuth, requireRole("author"), async (req, res) => {
  try {
    const [[paper]] = await pool.query("SELECT author_id, status FROM papers WHERE id = ?", [req.params.id]);
    if (!paper) return res.status(404).json({ error: "Paper not found" });
    if (paper.author_id !== req.user.id) return res.status(403).json({ error: "Not your submission" });
    if (paper.status !== "submitted") {
      return res.status(400).json({ error: "This submission can no longer be edited (a reviewer is already involved)" });
    }

    const { title, abstract, keywords } = req.body;
    if (!title || !abstract) return res.status(400).json({ error: "Title and abstract are required" });

    await pool.query("UPDATE papers SET title = ?, abstract = ?, keywords = ? WHERE id = ?", [
      title,
      abstract,
      keywords || null,
      req.params.id,
    ]);
    res.json({ message: "Submission updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update submission" });
  }
});

// ---------- AUTHOR: WITHDRAW A SUBMISSION (owner only, before a decision is made) ----------
router.patch("/:id/withdraw", requireAuth, requireRole("author"), async (req, res) => {
  try {
    const [[paper]] = await pool.query("SELECT author_id, status FROM papers WHERE id = ?", [req.params.id]);
    if (!paper) return res.status(404).json({ error: "Paper not found" });
    if (paper.author_id !== req.user.id) return res.status(403).json({ error: "Not your submission" });
    if (!["submitted", "under_review"].includes(paper.status)) {
      return res.status(400).json({ error: "This submission can no longer be withdrawn" });
    }

    await pool.query("UPDATE papers SET status = 'withdrawn' WHERE id = ?", [req.params.id]);
    res.json({ message: "Submission withdrawn" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to withdraw submission" });
  }
});

// ---------- REVIEWER: ACCEPT OR DECLINE AN ASSIGNMENT ----------
router.patch("/:id/reviewer-response", requireAuth, requireRole("reviewer"), async (req, res) => {
  try {
    const { response } = req.body;
    if (!["accepted", "declined"].includes(response)) {
      return res.status(400).json({ error: "Response must be 'accepted' or 'declined'" });
    }
    const [[paper]] = await pool.query("SELECT reviewer_id, status FROM papers WHERE id = ?", [req.params.id]);
    if (!paper) return res.status(404).json({ error: "Paper not found" });
    if (paper.reviewer_id !== req.user.id) return res.status(403).json({ error: "This paper isn't assigned to you" });

    if (response === "accepted") {
      await pool.query(
        "UPDATE papers SET reviewer_status = 'accepted', status = 'under_review' WHERE id = ?",
        [req.params.id]
      );
    } else {
      // Declining clears the assignment so an admin can hand it to someone else.
      await pool.query(
        "UPDATE papers SET reviewer_id = NULL, reviewer_status = NULL WHERE id = ?",
        [req.params.id]
      );
    }
    res.json({ message: response === "accepted" ? "Review accepted" : "Review declined" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to record your response" });
  }
});

// ---------- REVIEWER/ADMIN: UPDATE STATUS + COMMENTS + SCORES ----------
router.patch("/:id/review", requireAuth, requireRole("reviewer", "admin"), async (req, res) => {
  try {
    const { status, review_comments, score_originality, score_methodology, score_clarity, score_significance } = req.body;
    const allowed = ["under_review", "accepted", "rejected"];
    if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid status" });

    if (req.user.role === "reviewer") {
      const [[paper]] = await pool.query("SELECT reviewer_id, reviewer_status FROM papers WHERE id = ?", [req.params.id]);
      if (!paper || paper.reviewer_id !== req.user.id) {
        return res.status(403).json({ error: "This paper isn't assigned to you" });
      }
      if (paper.reviewer_status !== "accepted") {
        return res.status(400).json({ error: "Accept the review assignment before submitting a decision" });
      }
    }

    const scoreOrNull = (v) => (v === undefined || v === null || v === "" ? null : Math.min(5, Math.max(1, Number(v))));

    await pool.query(
      `UPDATE papers SET status = ?, review_comments = ?,
        score_originality = ?, score_methodology = ?, score_clarity = ?, score_significance = ?
       WHERE id = ?`,
      [
        status,
        review_comments || null,
        scoreOrNull(score_originality),
        scoreOrNull(score_methodology),
        scoreOrNull(score_clarity),
        scoreOrNull(score_significance),
        req.params.id,
      ]
    );

    // Notify the author by email (best-effort — never blocks the response)
    try {
      const [[paper]] = await pool.query(
        `SELECT p.title, COALESCE(u.name, p.author_name) AS author_name, COALESCE(u.email, p.author_email) AS author_email
         FROM papers p LEFT JOIN users u ON p.author_id = u.id WHERE p.id = ?`,
        [req.params.id]
      );
      if (paper) {
        const statusLine = STATUS_EMAIL_TEXT[status] || `Your submission's status changed to ${status}.`;
        await sendMail({
          to: paper.author_email,
          subject: `SIAHSSR: update on "${paper.title}"`,
          text: `Hi ${paper.author_name},\n\n${statusLine}\n\n"${paper.title}"\n${review_comments ? `\nReviewer comments:\n${review_comments}\n` : ""}\nYou can check full details from your author dashboard.`,
          html: `<p>Hi ${paper.author_name},</p><p>${statusLine}</p><p><strong>${paper.title}</strong></p>${review_comments ? `<p>Reviewer comments:</p><p>${review_comments.replace(/\n/g, "<br/>")}</p>` : ""}<p>You can check full details from your author dashboard.</p>`,
        });
      }
    } catch (mailErr) {
      console.error("Failed to send review status email:", mailErr.message);
    }

    res.json({ message: "Review updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update review" });
  }
});

module.exports = router;
