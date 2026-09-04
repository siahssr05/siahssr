const express = require("express");
const path = require("path");
const fs = require("fs");
const rateLimit = require("express-rate-limit");
const pool = require("../config/db");
const { sendMail } = require("../utils/mailer");
const { generateCaptcha, verifyCaptcha } = require("../utils/captcha");
const { uploadPaper } = require("../utils/upload");

const router = express.Router();

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: "Too many messages sent. Please try again later." },
});

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  message: { error: "Too many submissions from this connection. Please try again later." },
});

// The inbox every paid submission is emailed to, regardless of which journal
// the submitter picked — this is deliberately a fixed address, not read from
// site_settings, since it was given explicitly for this flow.
const SUBMISSION_INBOX = "editorijdssr@gmail.com";

// Site settings (hero text, contact info, navbar logo) — read-only for everyone
router.get("/settings", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT setting_key, setting_value FROM site_settings");
    const settings = {};
    rows.forEach((r) => (settings[r.setting_key] = r.setting_value));
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load site settings" });
  }
});

// About page objectives
router.get("/objectives", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM objectives ORDER BY sort_order, id");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load objectives" });
  }
});

// About page content (core values / objectives / mission)
router.get("/about-items", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM about_items ORDER BY section, sort_order, id");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load about page content" });
  }
});

// Public institute documents — list
router.get("/documents", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, title, category, original_filename, uploaded_at FROM documents ORDER BY uploaded_at DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load documents" });
  }
});

// Public institute documents — download
router.get("/documents/:id/download", async (req, res) => {
  try {
    const [[doc]] = await pool.query("SELECT * FROM documents WHERE id = ?", [req.params.id]);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    const absPath = path.join(__dirname, "..", doc.file_path.replace(/^\/+/, ""));
    if (!fs.existsSync(absPath)) return res.status(404).json({ error: "File not found on server" });
    res.download(absPath, doc.original_filename);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to download document" });
  }
});

// Home page announcements
router.get("/announcements", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM announcements ORDER BY created_at DESC LIMIT 5");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load announcements" });
  }
});

// Live homepage stats
router.get("/stats", async (req, res) => {
  try {
    const [[{ total_published }]] = await pool.query(
      "SELECT COUNT(*) AS total_published FROM papers WHERE status='published'"
    );
    const [[{ total_journals }]] = await pool.query("SELECT COUNT(*) AS total_journals FROM journals");
    const [[{ total_reviewers }]] = await pool.query(
      "SELECT COUNT(*) AS total_reviewers FROM users WHERE role='reviewer'"
    );
    // No more author accounts to count (submissions don't create a user) —
    // count distinct authors across published papers instead, which works
    // for both the legacy author-account papers and the new no-account ones.
    const [[{ total_authors }]] = await pool.query(
      `SELECT COUNT(DISTINCT COALESCE(author_id, author_email, author_name)) AS total_authors
       FROM papers WHERE status = 'published'`
    );
    const [[{ total_board_members }]] = await pool.query("SELECT COUNT(*) AS total_board_members FROM editorial_board");
    const [latestPapers] = await pool.query(
      `SELECT p.id, p.title, p.published_at, COALESCE(u.name, p.author_name) AS author_name, j.short_name
       FROM papers p LEFT JOIN users u ON p.author_id = u.id JOIN journals j ON p.journal_id = j.id
       WHERE p.status = 'published' ORDER BY p.published_at DESC LIMIT 4`
    );
    res.json({ total_published, total_journals, total_reviewers, total_authors, total_board_members, latestPapers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load homepage stats" });
  }
});

// ---------- CAPTCHA: get a question + signed token (used by submit/contact forms) ----------
router.get("/captcha", (req, res) => {
  res.json(generateCaptcha());
});

// ---------- PUBLIC PAPER SUBMISSION (no account needed) ----------
// Visitor pays ₹899 via the UPI QR/VPA shown on the page, self-declares the
// payment (checkbox + their UPI transaction/reference number — there's no
// payment gateway wired up here, so this is a manual/self-declared
// confirmation, not an automatic one), then uploads their .docx with these
// 7 fields. Stored in `submissions` for the admin dashboard AND emailed to
// editorijdssr@gmail.com with the file attached, so nothing depends on the
// admin remembering to check the dashboard.
router.post("/submit", submitLimiter, uploadPaper.single("file"), async (req, res) => {
  try {
    const {
      author_name,
      designation,
      institute_address,
      email,
      title,
      contact_no,
      journal_id,
      payment_reference,
      captchaToken,
      captchaAnswer,
    } = req.body;

    const missing = [];
    if (!author_name) missing.push("Author's name");
    if (!institute_address) missing.push("Institute name and address");
    if (!email) missing.push("Email id");
    if (!title) missing.push("Title of the paper");
    if (!contact_no) missing.push("Contact no");
    if (!payment_reference) missing.push("UPI transaction / reference number");
    if (!req.file) missing.push("Article file (.docx)");

    if (missing.length > 0) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: `Missing required field(s): ${missing.join(", ")}` });
    }
    if (!verifyCaptcha(captchaToken, captchaAnswer)) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: "Captcha answer is incorrect or expired. Please try again." });
    }

    const relativeFilePath = `/uploads/papers/${req.file.filename}`;
    const journalIdNum = journal_id ? Number(journal_id) : null;

    const [result] = await pool.query(
      `INSERT INTO submissions
        (author_name, designation, institute_address, email, title, contact_no, journal_id, file_path, original_filename, payment_reference, payment_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 899.00)`,
      [
        author_name,
        designation || null,
        institute_address,
        email,
        title,
        contact_no,
        journalIdNum || null,
        relativeFilePath,
        req.file.originalname,
        payment_reference,
      ]
    );
    const submissionId = result.insertId;

    const absFilePath = path.join(__dirname, "..", "uploads", "papers", req.file.filename);

    // Email the full submission (with the .docx attached) to the editor inbox.
    try {
      await sendMail({
        to: SUBMISSION_INBOX,
        replyTo: email,
        subject: `New paper submission: "${title}"`,
        text: `A new paper was submitted through the SIAHSSR website.\n\nAuthor's Name: ${author_name}\nDesignation: ${designation || "—"}\nInstitute Name & Address: ${institute_address}\nEmail id: ${email}\nTitle of the Paper: ${title}\nContact No: ${contact_no}\nPayment: Rs. 899 — UPI reference: ${payment_reference}\n\nThe article (.docx) is attached. Submission #${submissionId}.`,
        html: `<p>A new paper was submitted through the SIAHSSR website.</p>
          <table cellpadding="4" style="border-collapse:collapse;">
            <tr><td><strong>Author's Name</strong></td><td>${author_name}</td></tr>
            <tr><td><strong>Designation</strong></td><td>${designation || "—"}</td></tr>
            <tr><td><strong>Institute Name &amp; Address</strong></td><td>${institute_address}</td></tr>
            <tr><td><strong>Email id</strong></td><td>${email}</td></tr>
            <tr><td><strong>Title of the Paper</strong></td><td>${title}</td></tr>
            <tr><td><strong>Contact No</strong></td><td>${contact_no}</td></tr>
            <tr><td><strong>Payment</strong></td><td>Rs. 899 — UPI reference: ${payment_reference}</td></tr>
          </table>
          <p>The article (.docx) is attached. Submission #${submissionId}.</p>`,
        attachments: [{ filename: req.file.originalname, path: absFilePath }],
      });
    } catch (mailErr) {
      console.error("Failed to email submission to editor inbox:", mailErr.message);
    }

    // Confirmation email back to the submitter.
    try {
      await sendMail({
        to: email,
        subject: `SIAHSSR: we've received your paper "${title}"`,
        text: `Hi ${author_name},\n\nThank you — we've received your paper "${title}" along with your payment reference (${payment_reference}). Our editorial team will review it and get back to you at this email address once a decision is made.\n\nSubmission reference: #${submissionId}`,
        html: `<p>Hi ${author_name},</p><p>Thank you — we've received your paper <strong>${title}</strong> along with your payment reference (${payment_reference}). Our editorial team will review it and get back to you at this email address once a decision is made.</p><p>Submission reference: #${submissionId}</p>`,
      });
    } catch (mailErr) {
      console.error("Failed to send submitter confirmation email:", mailErr.message);
    }

    res.status(201).json({
      message: "Thank you — your paper and payment reference have been received. A confirmation email is on its way to you.",
      submissionId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to submit your paper" });
  }
});

// ---------- CONTACT FORM: visitor sends a message ----------
router.post("/contact", contactLimiter, async (req, res) => {
  try {
    const { name, email, subject, message, captchaToken, captchaAnswer } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: "Name, email and message are required" });
    }
    if (!verifyCaptcha(captchaToken, captchaAnswer)) {
      return res.status(400).json({ error: "Captcha answer is incorrect or expired. Please try again." });
    }

    await pool.query(
      "INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)",
      [name, email, subject || null, message]
    );

    const [[{ setting_value: adminEmail } = {}]] = await pool.query(
      "SELECT setting_value FROM site_settings WHERE setting_key = 'contact_email'"
    );
    if (adminEmail) {
      await sendMail({
        to: adminEmail,
        subject: `New contact message: ${subject || "(no subject)"}`,
        text: `From: ${name} <${email}>\n\n${message}`,
        html: `<p><strong>From:</strong> ${name} &lt;${email}&gt;</p><p>${(message || "").replace(/\n/g, "<br/>")}</p>`,
      });
    }

    res.status(201).json({ message: "Thanks for reaching out — we'll get back to you soon." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// ---------- EVENTS & NEWS (public list) ----------
router.get("/events", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM events ORDER BY (event_date IS NULL), event_date DESC, created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load events" });
  }
});

// ---------- NOTICES (image-based notice board shown on the homepage sidebar) ----------
router.get("/notices", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, title, image_path, created_at FROM notices ORDER BY created_at DESC LIMIT 10"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load notices" });
  }
});

// ---------- PUBLIC AUTHOR PROFILE (name/affiliation/ORCID + their published papers) ----------
router.get("/authors/:id", async (req, res) => {
  try {
    const [[author]] = await pool.query(
      "SELECT id, name, affiliation, orcid, role FROM users WHERE id = ? AND role IN ('author','reviewer')",
      [req.params.id]
    );
    if (!author) return res.status(404).json({ error: "Author not found" });

    const [papers] = await pool.query(
      `SELECT p.id, p.title, p.volume, p.issue, p.published_at, j.short_name
       FROM papers p JOIN journals j ON p.journal_id = j.id
       WHERE p.author_id = ? AND p.status = 'published'
       ORDER BY p.published_at DESC`,
      [req.params.id]
    );
    res.json({ ...author, papers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load author profile" });
  }
});

module.exports = router;
