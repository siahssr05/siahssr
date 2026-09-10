const express = require("express");
const pool = require("../config/db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { uploadImage } = require("../utils/upload");

const router = express.Router();

// ---------- PUBLIC: LIST BOARD MEMBERS ----------
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT eb.*, j.short_name AS journal_short_name
       FROM editorial_board eb LEFT JOIN journals j ON eb.journal_id = j.id
       ORDER BY eb.sort_order, eb.id`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load editorial board" });
  }
});

// ---------- ADMIN: ADD BOARD MEMBER (with optional photo) ----------
router.post("/", requireAuth, requireRole("admin"), uploadImage.single("photo"), async (req, res) => {
  try {
    const { name, designation, affiliation, bio, expertise, email, phone, journal_id, sort_order } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    const photoPath = req.file ? `/uploads/board/${req.file.filename}` : null;

    const [result] = await pool.query(
      `INSERT INTO editorial_board (name, designation, affiliation, photo_path, bio, expertise, email, phone, journal_id, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, designation || null, affiliation || null, photoPath, bio || null, expertise || null, email || null, phone || null, journal_id || null, sort_order || 0]
    );
    res.status(201).json({ message: "Board member added", id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add board member" });
  }
});

// ---------- ADMIN: UPDATE BOARD MEMBER ----------
router.put("/:id", requireAuth, requireRole("admin"), uploadImage.single("photo"), async (req, res) => {
  try {
    const { name, designation, affiliation, bio, expertise, email, phone, journal_id, sort_order } = req.body;

    if (req.file) {
      const photoPath = `/uploads/board/${req.file.filename}`;
      await pool.query(
        `UPDATE editorial_board SET name=?, designation=?, affiliation=?, bio=?, expertise=?, email=?, phone=?, journal_id=?, sort_order=?, photo_path=?
         WHERE id=?`,
        [name, designation || null, affiliation || null, bio || null, expertise || null, email || null, phone || null, journal_id || null, sort_order || 0, photoPath, req.params.id]
      );
    } else {
      await pool.query(
        `UPDATE editorial_board SET name=?, designation=?, affiliation=?, bio=?, expertise=?, email=?, phone=?, journal_id=?, sort_order=?
         WHERE id=?`,
        [name, designation || null, affiliation || null, bio || null, expertise || null, email || null, phone || null, journal_id || null, sort_order || 0, req.params.id]
      );
    }
    res.json({ message: "Board member updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update board member" });
  }
});

// ---------- ADMIN: DELETE BOARD MEMBER ----------
router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    await pool.query("DELETE FROM editorial_board WHERE id = ?", [req.params.id]);
    res.json({ message: "Board member removed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove board member" });
  }
});

module.exports = router;
