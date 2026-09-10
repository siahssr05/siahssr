const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { uploadLogo, uploadDocument, uploadNotice, uploadPaperOrPdf } = require("../utils/upload");
const { sendMail } = require("../utils/mailer");
const { logAction } = require("../utils/audit");
const { sendCsv } = require("../utils/csv");

const router = express.Router();

// All routes below require an authenticated admin
router.use(requireAuth, requireRole("admin"));

function paginationParams(req, defaultLimit = 25) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

// ---------- DASHBOARD STATS ----------
router.get("/stats", async (req, res) => {
  try {
    const [[{ total_papers }]] = await pool.query("SELECT COUNT(*) AS total_papers FROM papers");
    const [[{ total_published }]] = await pool.query(
      "SELECT COUNT(*) AS total_published FROM papers WHERE status='published'"
    );
    const [[{ total_users }]] = await pool.query("SELECT COUNT(*) AS total_users FROM users");
    const [statusBreakdown] = await pool.query("SELECT status, COUNT(*) AS count FROM papers GROUP BY status");
    const [byJournal] = await pool.query(
      `SELECT j.name, COUNT(p.id) AS paper_count FROM journals j LEFT JOIN papers p ON j.id = p.journal_id GROUP BY j.id`
    );
    res.json({ total_papers, total_published, total_users, statusBreakdown, byJournal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

// ---------- USERS ----------
// Paginated: ?page=1&limit=25. Omit query params to get page 1 of 25 as before.
router.get("/users", async (req, res) => {
  try {
    const { page, limit, offset } = paginationParams(req);
    const [[{ total }]] = await pool.query("SELECT COUNT(*) AS total FROM users");
    const [rows] = await pool.query(
      `SELECT id, name, email, role, affiliation, orcid, last_login, created_at
       FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    res.json({ rows, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load users" });
  }
});

// ---------- USERS: CSV EXPORT (all users, unpaginated) ----------
router.get("/export/users.csv", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, email, role, affiliation, orcid, last_login, created_at FROM users ORDER BY created_at DESC"
    );
    sendCsv(res, "users.csv", rows, [
      { key: "id", label: "ID" },
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "role", label: "Role" },
      { key: "affiliation", label: "Affiliation" },
      { key: "orcid", label: "ORCID" },
      { key: "last_login", label: "Last Login" },
      { key: "created_at", label: "Joined" },
    ]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to export users" });
  }
});

router.patch("/users/:id/role", async (req, res) => {
  try {
    const { role } = req.body;
    if (!["author", "reviewer", "admin"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    await pool.query("UPDATE users SET role = ? WHERE id = ?", [role, req.params.id]);
    await logAction(req.user.id, "user.role_changed", { userId: Number(req.params.id), role });
    res.json({ message: "Role updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update role" });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM users WHERE id = ?", [req.params.id]);
    await logAction(req.user.id, "user.deleted", { userId: Number(req.params.id) });
    res.json({ message: "User deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// ---------- ALL PAPERS (admin view, any status) ----------
// Paginated: ?page=1&limit=25.
router.get("/papers", async (req, res) => {
  try {
    const { page, limit, offset } = paginationParams(req);
    const [[{ total }]] = await pool.query("SELECT COUNT(*) AS total FROM papers");
    const [rows] = await pool.query(
      `SELECT p.*, COALESCE(u.name, p.author_name) AS author_name, j.name AS journal_name
       FROM papers p LEFT JOIN users u ON p.author_id = u.id JOIN journals j ON p.journal_id = j.id
       ORDER BY p.submitted_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    res.json({ rows, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load papers" });
  }
});

// ---------- PAPERS: CSV EXPORT (all papers, unpaginated) ----------
router.get("/export/papers.csv", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.id, p.title, p.status, p.volume, p.issue, p.doi, COALESCE(u.name, p.author_name) AS author_name, j.short_name,
              p.submitted_at, p.published_at
       FROM papers p LEFT JOIN users u ON p.author_id = u.id JOIN journals j ON p.journal_id = j.id
       ORDER BY p.submitted_at DESC`
    );
    sendCsv(res, "papers.csv", rows, [
      { key: "id", label: "ID" },
      { key: "title", label: "Title" },
      { key: "status", label: "Status" },
      { key: "author_name", label: "Author" },
      { key: "short_name", label: "Journal" },
      { key: "volume", label: "Volume" },
      { key: "issue", label: "Issue" },
      { key: "doi", label: "DOI" },
      { key: "submitted_at", label: "Submitted" },
      { key: "published_at", label: "Published" },
    ]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to export papers" });
  }
});

// Assigning a reviewer no longer force-flips status to under_review — the
// reviewer must accept first (see papers.js PATCH /:id/reviewer-response).
router.patch("/papers/:id/assign-reviewer", async (req, res) => {
  try {
    const { reviewer_id } = req.body;
    await pool.query("UPDATE papers SET reviewer_id = ?, reviewer_status = 'pending' WHERE id = ?", [
      reviewer_id,
      req.params.id,
    ]);
    await logAction(req.user.id, "paper.reviewer_assigned", { paperId: Number(req.params.id), reviewer_id });

    // Ask the reviewer to accept/decline (best-effort)
    try {
      const [[info]] = await pool.query(
        `SELECT p.title, r.name AS reviewer_name, r.email AS reviewer_email
         FROM papers p JOIN users r ON r.id = ? WHERE p.id = ?`,
        [reviewer_id, req.params.id]
      );
      if (info) {
        await sendMail({
          to: info.reviewer_email,
          subject: `SIAHSSR: review request — "${info.title}"`,
          text: `Hi ${info.reviewer_name},\n\nYou've been asked to review "${info.title}". Please log in to your reviewer dashboard to accept or decline.`,
          html: `<p>Hi ${info.reviewer_name},</p><p>You've been asked to review <strong>${info.title}</strong>. Please log in to your reviewer dashboard to accept or decline.</p>`,
        });
      }
    } catch (mailErr) {
      console.error("Failed to send reviewer request email:", mailErr.message);
    }

    res.json({ message: "Reviewer assigned — awaiting their acceptance" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to assign reviewer" });
  }
});

router.patch("/papers/:id/publish", async (req, res) => {
  try {
    const { volume, issue, doi } = req.body;
    await pool.query(
      "UPDATE papers SET status='published', published_at=NOW(), volume=?, issue=?, doi=? WHERE id=?",
      [volume || null, issue || null, doi || null, req.params.id]
    );
    await logAction(req.user.id, "paper.published", { paperId: Number(req.params.id), volume, issue, doi });

    // Notify the author their paper is now live (best-effort)
    try {
      const [[paper]] = await pool.query(
        `SELECT p.title, COALESCE(u.name, p.author_name) AS author_name, COALESCE(u.email, p.author_email) AS author_email
         FROM papers p LEFT JOIN users u ON p.author_id = u.id WHERE p.id = ?`,
        [req.params.id]
      );
      if (paper && paper.author_email) {
        await sendMail({
          to: paper.author_email,
          subject: `SIAHSSR: "${paper.title}" is now published`,
          text: `Hi ${paper.author_name},\n\nGreat news — your paper "${paper.title}" has been published${volume ? ` (Vol. ${volume}${issue ? `, Issue ${issue}` : ""})` : ""}.\n\nIt's now live on the public Papers Archive.`,
          html: `<p>Hi ${paper.author_name},</p><p>Great news — your paper <strong>${paper.title}</strong> has been published${volume ? ` (Vol. ${volume}${issue ? `, Issue ${issue}` : ""})` : ""}.</p><p>It's now live on the public Papers Archive.</p>`,
        });
      }
    } catch (mailErr) {
      console.error("Failed to send publish notification email:", mailErr.message);
    }

    res.json({ message: "Paper published" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to publish paper" });
  }
});

router.delete("/papers/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM papers WHERE id = ?", [req.params.id]);
    await logAction(req.user.id, "paper.deleted", { paperId: Number(req.params.id) });
    res.json({ message: "Paper deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete paper" });
  }
});

// ---------- PAPERS: FULL EDIT (admin CRUD — any field, any status) ----------
router.put("/papers/:id", async (req, res) => {
  try {
    const {
      title,
      abstract,
      keywords,
      author_name,
      author_designation,
      author_institute,
      author_email,
      author_contact,
      journal_id,
      volume,
      issue,
      doi,
      status,
    } = req.body;

    if (!title || !journal_id) return res.status(400).json({ error: "Title and journal are required" });
    const allowedStatuses = ["submitted", "under_review", "accepted", "rejected", "published", "withdrawn"];
    const finalStatus = allowedStatuses.includes(status) ? status : undefined;

    await pool.query(
      `UPDATE papers SET
        title = ?, abstract = ?, keywords = ?,
        author_name = ?, author_designation = ?, author_institute = ?, author_email = ?, author_contact = ?,
        journal_id = ?, volume = ?, issue = ?, doi = ?
        ${finalStatus ? ", status = ?" : ""}
       WHERE id = ?`,
      [
        title,
        abstract || null,
        keywords || null,
        author_name || null,
        author_designation || null,
        author_institute || null,
        author_email || null,
        author_contact || null,
        journal_id,
        volume || null,
        issue || null,
        doi || null,
        ...(finalStatus ? [finalStatus] : []),
        req.params.id,
      ]
    );
    await logAction(req.user.id, "paper.edited", { paperId: Number(req.params.id), title });
    res.json({ message: "Paper updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update paper" });
  }
});

// ---------- PAPERS: MANUAL ADD (admin creates a paper directly, e.g. a walk-in submission) ----------
// Uses uploadPaperOrPdf (not uploadPaper) so an admin can attach either a
// Word (.docx) or a PDF file here — this is the one paper-upload path an
// admin drives directly, as opposed to the public docx-only submission form
// (routes/public.js) and the logged-in author submission route just above
// in this file's sibling papers.js, both of which are untouched and stay
// docx-only.
router.post("/papers", uploadPaperOrPdf.single("file"), async (req, res) => {
  try {
    const {
      title,
      abstract,
      keywords,
      author_name,
      author_designation,
      author_institute,
      author_email,
      author_contact,
      journal_id,
      volume,
      issue,
      doi,
      status,
    } = req.body;

    if (!title || !author_name || !journal_id) {
      return res.status(400).json({ error: "Title, author name and journal are required" });
    }
    const allowedStatuses = ["submitted", "under_review", "accepted", "rejected", "published", "withdrawn"];
    const finalStatus = allowedStatuses.includes(status) ? status : "submitted";
    const filePath = req.file ? `/uploads/papers/${req.file.filename}` : null;

    const [result] = await pool.query(
      `INSERT INTO papers
        (title, abstract, keywords, author_name, author_designation, author_institute, author_email, author_contact,
         journal_id, volume, issue, doi, status, file_path, original_filename,
         published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        abstract || null,
        keywords || null,
        author_name,
        author_designation || null,
        author_institute || null,
        author_email || null,
        author_contact || null,
        journal_id,
        volume || null,
        issue || null,
        doi || null,
        finalStatus,
        filePath,
        req.file ? req.file.originalname : null,
        finalStatus === "published" ? new Date() : null,
      ]
    );
    await logAction(req.user.id, "paper.created", { paperId: result.insertId, title });
    res.status(201).json({ message: "Paper added", id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add paper" });
  }
});

// ---------- SUBMISSIONS (public pay-then-submit paper flow) ----------
router.get("/submissions", async (req, res) => {
  try {
    const { page, limit, offset } = paginationParams(req);
    const { status } = req.query;
    const where = status ? "WHERE s.status = ?" : "";
    const params = status ? [status] : [];

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM submissions s ${where}`, params);
    const [rows] = await pool.query(
      `SELECT s.*, j.name AS journal_name, j.short_name
       FROM submissions s LEFT JOIN journals j ON s.journal_id = j.id
       ${where}
       ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json({ rows, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load submissions" });
  }
});

router.get("/submissions/:id/download", async (req, res) => {
  try {
    const [[submission]] = await pool.query("SELECT * FROM submissions WHERE id = ?", [req.params.id]);
    if (!submission) return res.status(404).json({ error: "Submission not found" });
    const absPath = path.join(__dirname, "..", submission.file_path.replace(/^\/+/, ""));
    if (!fs.existsSync(absPath)) return res.status(404).json({ error: "File not found on server" });
    res.download(absPath, submission.original_filename || "article.docx");
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to download file" });
  }
});

router.patch("/submissions/:id", async (req, res) => {
  try {
    const { status, admin_notes } = req.body;
    const allowed = ["new", "reviewed", "published", "rejected"];
    if (status && !allowed.includes(status)) return res.status(400).json({ error: "Invalid status" });

    await pool.query("UPDATE submissions SET status = COALESCE(?, status), admin_notes = ? WHERE id = ?", [
      status || null,
      admin_notes !== undefined ? admin_notes : null,
      req.params.id,
    ]);
    await logAction(req.user.id, "submission.updated", { submissionId: Number(req.params.id), status });
    res.json({ message: "Submission updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update submission" });
  }
});

router.delete("/submissions/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM submissions WHERE id = ?", [req.params.id]);
    await logAction(req.user.id, "submission.deleted", { submissionId: Number(req.params.id) });
    res.json({ message: "Submission deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete submission" });
  }
});

// ---------- SUBMISSIONS: PUBLISH (turns a reviewed submission into a live published paper) ----------
router.post("/submissions/:id/publish", async (req, res) => {
  try {
    const { abstract, keywords, volume, issue, doi, journal_id } = req.body;
    const [[submission]] = await pool.query("SELECT * FROM submissions WHERE id = ?", [req.params.id]);
    if (!submission) return res.status(404).json({ error: "Submission not found" });
    if (submission.published_paper_id) {
      return res.status(400).json({ error: "This submission has already been published" });
    }

    const finalJournalId = journal_id || submission.journal_id;
    if (!finalJournalId) return res.status(400).json({ error: "A journal must be selected" });
    if (!abstract) return res.status(400).json({ error: "An abstract is required to publish" });

    const [result] = await pool.query(
      `INSERT INTO papers
        (title, abstract, keywords, author_name, author_designation, author_institute, author_email, author_contact,
         submission_id, journal_id, volume, issue, doi, status, file_path, original_filename, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, NOW())`,
      [
        submission.title,
        abstract,
        keywords || null,
        submission.author_name,
        submission.designation || null,
        submission.institute_address,
        submission.email,
        submission.contact_no,
        submission.id,
        finalJournalId,
        volume || null,
        issue || null,
        doi || null,
        submission.file_path,
        submission.original_filename,
      ]
    );
    const paperId = result.insertId;

    await pool.query("UPDATE submissions SET status = 'published', published_paper_id = ? WHERE id = ?", [
      paperId,
      submission.id,
    ]);
    await logAction(req.user.id, "submission.published", { submissionId: submission.id, paperId });

    try {
      await sendMail({
        to: submission.email,
        subject: `SIAHSSR: "${submission.title}" is now published`,
        text: `Hi ${submission.author_name},\n\nGreat news — your paper "${submission.title}" has been published${volume ? ` (Vol. ${volume}${issue ? `, Issue ${issue}` : ""})` : ""}.\n\nIt's now live on the public Papers Archive.`,
        html: `<p>Hi ${submission.author_name},</p><p>Great news — your paper <strong>${submission.title}</strong> has been published${volume ? ` (Vol. ${volume}${issue ? `, Issue ${issue}` : ""})` : ""}.</p><p>It's now live on the public Papers Archive.</p>`,
      });
    } catch (mailErr) {
      console.error("Failed to send publish notification email:", mailErr.message);
    }

    res.status(201).json({ message: "Submission published as a paper", paperId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to publish submission" });
  }
});

// ---------- USERS: CREATE (admin-only — public self-registration is disabled) ----------
router.post("/users", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email and password are required" });
    }
    const allowedRoles = ["author", "reviewer", "admin"];
    const finalRole = allowedRoles.includes(role) ? role : "admin";

    const [existing] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0) return res.status(409).json({ error: "An account with this email already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.query("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)", [
      name,
      email,
      hashed,
      finalRole,
    ]);
    await logAction(req.user.id, "user.created", { userId: result.insertId, email, role: finalRole });
    res.status(201).json({ message: "Account created", id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create account" });
  }
});

// ---------- ANALYTICS (submissions/publications over time, breakdowns) ----------
router.get("/analytics", async (req, res) => {
  try {
    const [monthlySubmissions] = await pool.query(
      `SELECT DATE_FORMAT(submitted_at, '%Y-%m') AS month, COUNT(*) AS count
       FROM papers
       WHERE submitted_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
       GROUP BY month ORDER BY month`
    );
    const [monthlyPublished] = await pool.query(
      `SELECT DATE_FORMAT(published_at, '%Y-%m') AS month, COUNT(*) AS count
       FROM papers
       WHERE published_at IS NOT NULL AND published_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
       GROUP BY month ORDER BY month`
    );
    const [statusBreakdown] = await pool.query("SELECT status, COUNT(*) AS count FROM papers GROUP BY status");
    const [byJournal] = await pool.query(
      `SELECT j.short_name, COUNT(p.id) AS total,
              SUM(CASE WHEN p.status = 'published' THEN 1 ELSE 0 END) AS published
       FROM journals j LEFT JOIN papers p ON j.id = p.journal_id
       GROUP BY j.id`
    );
    const [topReviewers] = await pool.query(
      `SELECT u.name, COUNT(p.id) AS reviewed_count
       FROM users u JOIN papers p ON p.reviewer_id = u.id
       WHERE u.role = 'reviewer'
       GROUP BY u.id ORDER BY reviewed_count DESC LIMIT 5`
    );
    res.json({ monthlySubmissions, monthlyPublished, statusBreakdown, byJournal, topReviewers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load analytics" });
  }
});

// ---------- SITE SETTINGS (home hero text, contact info, etc.) ----------
router.get("/settings", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM site_settings");
    const settings = {};
    rows.forEach((r) => (settings[r.setting_key] = r.setting_value));
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load settings" });
  }
});

router.put("/settings", async (req, res) => {
  try {
    const entries = Object.entries(req.body); // { hero_title: "...", contact_phone_1: "...", ... }
    for (const [key, value] of entries) {
      await pool.query(
        `INSERT INTO site_settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE setting_value = ?, updated_by = ?`,
        [key, value, req.user.id, value, req.user.id]
      );
    }
    res.json({ message: "Settings updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// ---------- SITE LOGO (navbar logo) ----------
router.post("/settings/logo", uploadLogo.single("logo"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No logo file received" });
    const relativePath = `/uploads/logos/${req.file.filename}`;
    await pool.query(
      `INSERT INTO site_settings (setting_key, setting_value, updated_by) VALUES ('site_logo', ?, ?)
       ON DUPLICATE KEY UPDATE setting_value = ?, updated_by = ?`,
      [relativePath, req.user.id, relativePath, req.user.id]
    );
    res.json({ message: "Site logo updated", logo_path: relativePath });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to upload site logo" });
  }
});

// ---------- ABOUT PAGE CONTENT (core values / objectives / mission) ----------
router.get("/about-items", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM about_items ORDER BY section, sort_order, id");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load about page content" });
  }
});

router.post("/about-items", async (req, res) => {
  try {
    const { section, text, sort_order } = req.body;
    if (!["core_value", "objective", "mission"].includes(section)) {
      return res.status(400).json({ error: "Invalid section" });
    }
    if (!text) return res.status(400).json({ error: "Text is required" });
    const [result] = await pool.query(
      "INSERT INTO about_items (section, text, sort_order) VALUES (?, ?, ?)",
      [section, text, sort_order || 0]
    );
    res.status(201).json({ message: "Added", id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add item" });
  }
});

router.put("/about-items/:id", async (req, res) => {
  try {
    const { text, sort_order } = req.body;
    await pool.query("UPDATE about_items SET text=?, sort_order=? WHERE id=?", [
      text,
      sort_order || 0,
      req.params.id,
    ]);
    res.json({ message: "Updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update item" });
  }
});

router.delete("/about-items/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM about_items WHERE id = ?", [req.params.id]);
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete item" });
  }
});

// ---------- INSTITUTE DOCUMENTS (upload/list/delete — stored files tracked in the DB) ----------
router.get("/documents", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM documents ORDER BY uploaded_at DESC");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load documents" });
  }
});

router.post("/documents", uploadDocument.single("file"), async (req, res) => {
  try {
    const { title, category } = req.body;
    if (!title || !req.file) return res.status(400).json({ error: "Title and file are required" });
    const relativePath = `/uploads/documents/${req.file.filename}`;
    const [result] = await pool.query(
      "INSERT INTO documents (title, category, file_path, original_filename, uploaded_by) VALUES (?, ?, ?, ?, ?)",
      [title, category || "general", relativePath, req.file.originalname, req.user.id]
    );
    res.status(201).json({ message: "Document uploaded", id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to upload document" });
  }
});

router.delete("/documents/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM documents WHERE id = ?", [req.params.id]);
    res.json({ message: "Document deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

// ---------- ANNOUNCEMENTS (Home page) ----------
router.get("/announcements", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM announcements ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load announcements" });
  }
});

router.post("/announcements", async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });
    const [result] = await pool.query("INSERT INTO announcements (title, content) VALUES (?, ?)", [
      title,
      content || null,
    ]);
    res.status(201).json({ message: "Announcement added", id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add announcement" });
  }
});

router.delete("/announcements/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM announcements WHERE id = ?", [req.params.id]);
    res.json({ message: "Announcement deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete announcement" });
  }
});

// ---------- EVENTS & NEWS (conferences, workshops, training programmes) ----------
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

router.post("/events", async (req, res) => {
  try {
    const { title, description, event_type, event_date, location } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });
    const allowedTypes = ["conference", "workshop", "training", "seminar", "other"];
    const finalType = allowedTypes.includes(event_type) ? event_type : "other";
    const [result] = await pool.query(
      "INSERT INTO events (title, description, event_type, event_date, location, created_by) VALUES (?, ?, ?, ?, ?, ?)",
      [title, description || null, finalType, event_date || null, location || null, req.user.id]
    );
    await logAction(req.user.id, "event.created", { eventId: result.insertId, title });
    res.status(201).json({ message: "Event added", id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add event" });
  }
});

router.put("/events/:id", async (req, res) => {
  try {
    const { title, description, event_type, event_date, location } = req.body;
    const allowedTypes = ["conference", "workshop", "training", "seminar", "other"];
    const finalType = allowedTypes.includes(event_type) ? event_type : "other";
    await pool.query(
      "UPDATE events SET title=?, description=?, event_type=?, event_date=?, location=? WHERE id=?",
      [title, description || null, finalType, event_date || null, location || null, req.params.id]
    );
    res.json({ message: "Event updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update event" });
  }
});

router.delete("/events/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM events WHERE id = ?", [req.params.id]);
    await logAction(req.user.id, "event.deleted", { eventId: Number(req.params.id) });
    res.json({ message: "Event deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete event" });
  }
});

// ---------- NOTICES (image-based notice board shown on the homepage) ----------
router.get("/notices", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM notices ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load notices" });
  }
});

router.post("/notices", uploadNotice.single("image"), async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || !req.file) return res.status(400).json({ error: "Title and image are required" });
    const relativePath = `/uploads/notices/${req.file.filename}`;
    const [result] = await pool.query(
      "INSERT INTO notices (title, image_path, posted_by) VALUES (?, ?, ?)",
      [title, relativePath, req.user.id]
    );
    await logAction(req.user.id, "notice.created", { noticeId: result.insertId, title });
    res.status(201).json({ message: "Notice posted", id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to post notice" });
  }
});

router.delete("/notices/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM notices WHERE id = ?", [req.params.id]);
    await logAction(req.user.id, "notice.deleted", { noticeId: Number(req.params.id) });
    res.json({ message: "Notice deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete notice" });
  }
});

// ---------- CONTACT MESSAGES (from the public Contact page) ----------
router.get("/contact-messages", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM contact_messages ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load messages" });
  }
});

// ---------- CONTACT MESSAGES: CSV EXPORT ----------
router.get("/export/contact-messages.csv", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM contact_messages ORDER BY created_at DESC");
    sendCsv(res, "contact-messages.csv", rows, [
      { key: "id", label: "ID" },
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "subject", label: "Subject" },
      { key: "message", label: "Message" },
      { key: "is_read", label: "Read" },
      { key: "created_at", label: "Received" },
    ]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to export messages" });
  }
});

router.patch("/contact-messages/:id/read", async (req, res) => {
  try {
    const { is_read } = req.body;
    await pool.query("UPDATE contact_messages SET is_read = ? WHERE id = ?", [is_read ? 1 : 0, req.params.id]);
    res.json({ message: "Updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update message" });
  }
});

router.delete("/contact-messages/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM contact_messages WHERE id = ?", [req.params.id]);
    res.json({ message: "Message deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

// ---------- AUDIT LOG (read-only trail of admin actions) ----------
// Paginated: ?page=1&limit=25.
router.get("/audit-log", async (req, res) => {
  try {
    const { page, limit, offset } = paginationParams(req);
    const [[{ total }]] = await pool.query("SELECT COUNT(*) AS total FROM audit_log");
    const [rows] = await pool.query(
      `SELECT a.*, u.name AS admin_name
       FROM audit_log a LEFT JOIN users u ON a.admin_id = u.id
       ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    res.json({ rows, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load audit log" });
  }
});

module.exports = router;
