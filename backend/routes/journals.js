const express = require("express");
const pool = require("../config/db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { uploadLogo } = require("../utils/upload");

const router = express.Router();

// ---------- PUBLIC: LIST JOURNALS ----------
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM journals ORDER BY id");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load journals" });
  }
});

// ---------- PUBLIC: SINGLE JOURNAL ----------
router.get("/:id", async (req, res) => {
  try {
    const [[journal]] = await pool.query("SELECT * FROM journals WHERE id = ?", [req.params.id]);
    if (!journal) return res.status(404).json({ error: "Journal not found" });
    res.json(journal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load journal" });
  }
});

// ---------- ADMIN: CREATE JOURNAL ----------
router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { name, short_name, issn, description, current_volume, current_issue, cfp_text, cfp_deadline } =
      req.body;
    if (!name || !short_name) return res.status(400).json({ error: "Name and short name are required" });

    const [result] = await pool.query(
      `INSERT INTO journals (name, short_name, issn, description, current_volume, current_issue, cfp_text, cfp_deadline)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, short_name, issn || null, description || null, current_volume || null, current_issue || null, cfp_text || null, cfp_deadline || null]
    );
    res.status(201).json({ message: "Journal created", id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create journal" });
  }
});

// ---------- ADMIN: UPDATE JOURNAL ----------
router.put("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { name, short_name, issn, description, current_volume, current_issue, cfp_text, cfp_deadline } =
      req.body;
    await pool.query(
      `UPDATE journals SET name=?, short_name=?, issn=?, description=?, current_volume=?, current_issue=?, cfp_text=?, cfp_deadline=?
       WHERE id=?`,
      [name, short_name, issn || null, description || null, current_volume || null, current_issue || null, cfp_text || null, cfp_deadline || null, req.params.id]
    );
    res.json({ message: "Journal updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update journal" });
  }
});

// ---------- ADMIN: UPLOAD/REPLACE JOURNAL LOGO ----------
router.post(
  "/:id/logo",
  requireAuth,
  requireRole("admin"),
  uploadLogo.single("logo"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No logo file received" });
      const relativePath = `/uploads/logos/${req.file.filename}`;
      await pool.query("UPDATE journals SET logo_path = ? WHERE id = ?", [relativePath, req.params.id]);
      res.json({ message: "Journal logo updated", logo_path: relativePath });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to upload logo" });
    }
  }
);

// ---------- ADMIN: DELETE JOURNAL ----------
router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    await pool.query("DELETE FROM journals WHERE id = ?", [req.params.id]);
    res.json({ message: "Journal deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete journal" });
  }
});

module.exports = router;
