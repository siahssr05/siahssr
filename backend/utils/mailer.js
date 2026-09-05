const fs = require("fs");
const nodemailer = require("nodemailer");

// Railway blocks raw outbound SMTP (ports 25/465/587) on its Free/Trial/Hobby
// plans to prevent spam/abuse — only the paid Pro plan allows it. That's why
// nodemailer's connection to smtp.gmail.com used to hang for ~2 minutes and
// then fail with "Connection timeout" for every single email. Resend sends
// over a normal HTTPS request instead of a raw SMTP socket, so it isn't
// affected by that block and works on every Railway plan.
//
// This still supports SMTP as a fallback (e.g. for local development, where
// nothing blocks outbound SMTP) — Resend is used whenever RESEND_API_KEY is
// set, which is what actually matters in production on Railway.

const RESEND_API_URL = "https://api.resend.com/emails";

function getFromAddress() {
  return process.env.RESEND_FROM || process.env.SMTP_FROM || "SIAHSSR <onboarding@resend.dev>";
}

// Resend's HTTP API wants attachment content as a base64 string, not a
// filesystem path — nodemailer's `{ filename, path }` shape (what the rest
// of this codebase already passes in) doesn't work there, so this reads the
// file and re-encodes it. Keeping that conversion in here means callers
// (public.js, admin.js, ...) don't need to know or care which email backend
// is actually in use.
async function toResendAttachments(attachments) {
  if (!attachments || attachments.length === 0) return undefined;
  return Promise.all(
    attachments.map(async (a) => {
      if (a.content) {
        return { filename: a.filename, content: Buffer.isBuffer(a.content) ? a.content.toString("base64") : a.content };
      }
      const buf = await fs.promises.readFile(a.path);
      return { filename: a.filename, content: buf.toString("base64") };
    })
  );
}

async function sendViaResend({ to, subject, html, text, attachments, replyTo }) {
  const resendAttachments = await toResendAttachments(attachments);
  const body = {
    from: getFromAddress(),
    to: Array.isArray(to) ? to : [to],
    subject,
    ...(html ? { html } : {}),
    ...(text ? { text } : {}),
    ...(replyTo ? { reply_to: replyTo } : {}),
    ...(resendAttachments ? { attachments: resendAttachments } : {}),
  };

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Resend API ${res.status}: ${errText || res.statusText}`);
  }
  return res.json();
}

let transporter = null;

function getSmtpTransporter() {
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

async function sendViaSmtp({ to, subject, html, text, attachments, replyTo }) {
  const t = getSmtpTransporter();
  if (!t) return null; // signals "not configured" to the caller below
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
}

/**
 * Sends an email — via Resend's HTTPS API if RESEND_API_KEY is set
 * (recommended, and required for this to actually work on Railway's
 * non-Pro plans), else via SMTP if that's configured (fine for local dev),
 * else just logs the content to the console so nothing is silently lost.
 */
async function sendMail({ to, subject, html, text, attachments, replyTo }) {
  try {
    if (process.env.RESEND_API_KEY) {
      await sendViaResend({ to, subject, html, text, attachments, replyTo });
      return { sent: true };
    }
    const smtpResult = await sendViaSmtp({ to, subject, html, text, attachments, replyTo });
    if (smtpResult) return smtpResult;

    console.log(`\n[email not sent — no RESEND_API_KEY or SMTP configured] To: ${to}\nSubject: ${subject}\n${text || html}\n`);
    return { sent: false };
  } catch (err) {
    console.error("Failed to send email:", err.message);
    console.log(`[email fallback] To: ${to}\nSubject: ${subject}\n${text || html}\n`);
    return { sent: false, error: err.message };
  }
}

module.exports = { sendMail };