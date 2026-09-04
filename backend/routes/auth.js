const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const pool = require("../config/db");
const { sendMail } = require("../utils/mailer");
const { verifyCaptcha } = require("../utils/captcha");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts. Please try again later." },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  message: { error: "Too many accounts created from this connection. Please try again later." },
});

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );
}

// ---------- REGISTER (disabled — this site is admin-login-only now) ----------
// Public self-registration (author/reviewer accounts) has been retired: the
// site no longer has author/reviewer logins at all — papers come in through
// the public no-account submission flow (routes/public.js POST /submit)
// instead, and admin accounts are created from the dashboard
// (POST /api/admin/users) rather than here. The route is kept, returning a
// clear error, so nothing throws a raw 404 if anything still points at it.
router.post("/register", registerLimiter, async (req, res) => {
  res.status(410).json({
    error: "Self-registration is no longer available. Submit a paper from the Submit a Paper page — no account needed.",
  });
});

// ---------- LOGIN ----------
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
    const user = rows[0];

    // Generic message either way — never reveal whether the email exists
    const invalidMsg = { error: "Invalid email or password" };
    if (!user) return res.status(401).json(invalidMsg);

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json(invalidMsg);

    await pool.query("UPDATE users SET last_login = NOW() WHERE id = ?", [user.id]);

    const token = signToken(user);

    res
      .cookie("token", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000,
      })
      .json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          photo_path: user.photo_path,
        },
      });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong, please try again" });
  }
});

// ---------- LOGOUT ----------
router.post("/logout", (req, res) => {
  res.clearCookie("token").json({ message: "Logged out" });
});

// ---------- FORGOT PASSWORD ----------
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const [rows] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);

    // Always respond the same way — don't reveal whether the email exists
    if (rows.length > 0) {
      const resetToken = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await pool.query(
        "UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?",
        [resetToken, expires, rows[0].id]
      );
      const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
      await sendMail({
        to: email,
        subject: "Reset your SIAHSSR password",
        text: `We received a request to reset your password. Open this link to choose a new one (valid for 1 hour):\n${resetUrl}\n\nIf you didn't request this, you can ignore this email.`,
        html: `<p>We received a request to reset your password. Click the link below to choose a new one (valid for 1 hour):</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
      });
    }
    res.json({ message: "If that email exists, a reset link has been sent." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// ---------- RESET PASSWORD ----------
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: "Missing token or new password" });

    const [rows] = await pool.query(
      "SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > NOW()",
      [token]
    );
    if (rows.length === 0) return res.status(400).json({ error: "Invalid or expired reset link" });

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query(
      "UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?",
      [hashed, rows[0].id]
    );
    res.json({ message: "Password updated. You can now log in." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// ---------- MY PROFILE (self-service: name, affiliation, ORCID) ----------
router.get("/profile", requireAuth, async (req, res) => {
  try {
    const [[user]] = await pool.query(
      "SELECT id, name, email, role, affiliation, orcid, photo_path FROM users WHERE id = ?",
      [req.user.id]
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load profile" });
  }
});

router.put("/profile", requireAuth, async (req, res) => {
  try {
    const { name, affiliation, orcid } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    if (orcid && !/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(orcid)) {
      return res.status(400).json({ error: "ORCID should look like 0000-0000-0000-0000" });
    }
    await pool.query("UPDATE users SET name = ?, affiliation = ?, orcid = ? WHERE id = ?", [
      name,
      affiliation || null,
      orcid || null,
      req.user.id,
    ]);
    res.json({ message: "Profile updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

module.exports = router;
