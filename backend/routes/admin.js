router.put("/announcements/:id", async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });
    await pool.query("UPDATE announcements SET title = ?, content = ? WHERE id = ?", [
      title,
      content || null,
      req.params.id,
    ]);
    res.json({ message: "Announcement updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update announcement" });
  }
});
