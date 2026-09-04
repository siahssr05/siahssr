const pool = require("../config/db");

/**
 * Records an admin action in the audit_log table. Best-effort — a logging
 * failure is logged to the console but never blocks the action itself.
 */
async function logAction(adminId, action, details) {
  try {
    await pool.query("INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)", [
      adminId || null,
      action,
      typeof details === "string" ? details : JSON.stringify(details || {}),
    ]);
  } catch (err) {
    console.error("Failed to write audit log:", err.message);
  }
}

module.exports = { logAction };
