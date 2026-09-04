const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null; // not configured — caller falls back to console logging
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

/**
 * Sends an email if SMTP is configured; otherwise logs the content to the
 * console so nothing is silently lost during local development.
 */
async function sendMail({ to, subject, html, text, attachments, replyTo }) {
  const t = getTransporter();
  if (!t) {
    console.log(`\n[email not sent — SMTP not configured] To: ${to}\nSubject: ${subject}\n${text || html}\n`);
    return { sent: false };
  }
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || `SIAHSSR <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      text,
      ...(attachments ? { attachments } : {}),
      ...(replyTo ? { replyTo } : {}),
    });
    return { sent: true };
  } catch (err) {
    console.error("Failed to send email:", err.message);
    console.log(`[email fallback] To: ${to}\nSubject: ${subject}\n${text || html}\n`);
    return { sent: false, error: err.message };
  }
}

module.exports = { sendMail };
