const express = require("express");
const pool = require("../config/db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM faqs ORDER BY category, sort_order, id");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load FAQs" });
  }
});

router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { question, answer, category, sort_order } = req.body;
    if (!question || !answer) return res.status(400).json({ error: "Question and answer are required" });

    const [result] = await pool.query(
      "INSERT INTO faqs (question, answer, category, sort_order) VALUES (?, ?, ?, ?)",
      [question, answer, category || "general", sort_order || 0]
    );
    res.status(201).json({ message: "FAQ added", id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add FAQ" });
  }
});

router.put("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { question, answer, category, sort_order } = req.body;
    await pool.query(
      "UPDATE faqs SET question=?, answer=?, category=?, sort_order=? WHERE id=?",
      [question, answer, category || "general", sort_order || 0, req.params.id]
    );
    res.json({ message: "FAQ updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update FAQ" });
  }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    await pool.query("DELETE FROM faqs WHERE id = ?", [req.params.id]);
    res.json({ message: "FAQ deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete FAQ" });
  }
});

module.exports = router;
