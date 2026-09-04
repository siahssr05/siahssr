const crypto = require("crypto");

// Stateless math captcha: no server-side session/storage needed. The
// question's answer + an expiry are signed with HMAC using JWT_SECRET, so a
// token minted by GET /api/public/captcha can be verified later by any
// request without a database round trip, and can't be tampered with.

const TTL_MS = 5 * 60 * 1000; // 5 minutes to answer

function secret() {
  return process.env.JWT_SECRET || "dev-only-fallback-secret";
}

function sign(payload) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

function generateCaptcha() {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  const expires = Date.now() + TTL_MS;
  const payload = `${a}:${b}:${expires}`;
  const sig = sign(payload);
  const token = Buffer.from(`${payload}:${sig}`).toString("base64");
  return { question: `${a} + ${b} = ?`, token };
}

function verifyCaptcha(token, answer) {
  try {
    if (!token || answer === undefined || answer === null || answer === "") return false;
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 4) return false;
    const [a, b, expires, sig] = parts;
    const payload = `${a}:${b}:${expires}`;
    if (sign(payload) !== sig) return false;
    if (Date.now() > Number(expires)) return false;
    return Number(answer) === Number(a) + Number(b);
  } catch {
    return false;
  }
}

module.exports = { generateCaptcha, verifyCaptcha };
