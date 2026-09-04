require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");

const authRoutes = require("./routes/auth");
const papersRoutes = require("./routes/papers");
const journalsRoutes = require("./routes/journals");
const boardRoutes = require("./routes/board");
const faqRoutes = require("./routes/faq");
const adminRoutes = require("./routes/admin");
const publicRoutes = require("./routes/public");
const pool = require("./config/db");

// The plain HTML/CSS/JS frontend (formerly a separate React+Vite app) lives
// one level up, in ../frontend-html. This server now serves it directly —
// see the express.static block near the bottom of this file — so the site
// is one process on one origin instead of two servers on two ports.
const FRONTEND_DIR = path.join(__dirname, "..", "frontend-html");

const app = express();

// Ensure upload folders exist even on a fresh clone
["papers", "board", "logos", "receipts", "notices", "documents"].forEach((sub) => {
  const dir = path.join(__dirname, "uploads", sub);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// The frontend now shares this server's origin (see express.static below),
// so the browser no longer sends cross-origin requests for normal use and
// this CORS config isn't load-bearing anymore. Left in place so hitting the
// API directly from a different origin (a separate dev server, a script,
// Postman) still works during development.
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5000",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Baseline rate limit across the whole API — the more sensitive endpoints
// (login, register, contact, submit) layer their own stricter limiters on top.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down and try again shortly." },
});
app.use("/api", apiLimiter);

// Static file serving for uploaded logos/photos/papers/receipts
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/papers", papersRoutes);
app.use("/api/journals", journalsRoutes);
app.use("/api/board", boardRoutes);
app.use("/api/faq", faqRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/public", publicRoutes);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// ---------- SEO: robots.txt + sitemap.xml (points crawlers at public pages) ----------
// Built from the request's own host, since the frontend is this same origin
// now — no CLIENT_URL guesswork needed.
app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(`User-agent: *\nAllow: /\nSitemap: ${req.protocol}://${req.get("host")}/sitemap.xml\n`);
});

app.get("/sitemap.xml", async (req, res) => {
  try {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const staticPaths = [
      "/", "/about.html", "/journals.html", "/papers.html", "/board.html",
      "/events.html", "/guidelines.html", "/faq.html", "/contact.html",
    ];
    const [papers] = await pool.query(
      "SELECT id, updated_at FROM papers WHERE status = 'published' ORDER BY published_at DESC"
    );
    const [journals] = await pool.query("SELECT id FROM journals");

    const urls = [
      ...staticPaths.map((p) => `<url><loc>${baseUrl}${p}</loc></url>`),
      ...journals.map((j) => `<url><loc>${baseUrl}/journal-detail.html?id=${j.id}</loc></url>`),
      ...papers.map(
        (p) =>
          `<url><loc>${baseUrl}/paper-detail.html?id=${p.id}</loc>${
            p.updated_at ? `<lastmod>${new Date(p.updated_at).toISOString().slice(0, 10)}</lastmod>` : ""
          }</url>`
      ),
    ];

    res.type("application/xml").send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join(
        "\n"
      )}\n</urlset>`
    );
  } catch (err) {
    console.error(err);
    res.status(500).type("text/plain").send("Failed to generate sitemap");
  }
});

// ---------- RSS: /feed.xml — the most recently published papers ----------
// Linked from the homepage/papers page <head> (rel="alternate") and the
// footer, so any feed reader can pick up new publications automatically.
function escXml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

app.get("/feed.xml", async (req, res) => {
  try {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const [papers] = await pool.query(
      `SELECT p.id, p.title, p.abstract, p.published_at, COALESCE(u.name, p.author_name) AS author_name, j.name AS journal_name
       FROM papers p
       LEFT JOIN users u ON p.author_id = u.id
       JOIN journals j ON p.journal_id = j.id
       WHERE p.status = 'published'
       ORDER BY p.published_at DESC
       LIMIT 30`
    );

    const items = papers
      .map((p) => {
        const link = `${baseUrl}/paper-detail.html?id=${p.id}`;
        const pubDate = new Date(p.published_at || Date.now()).toUTCString();
        const description = `${p.author_name} — ${p.journal_name}. ${(p.abstract || "").slice(0, 300)}`;
        return `
    <item>
      <title>${escXml(p.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="false">siahssr-paper-${p.id}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escXml(description)}</description>
    </item>`;
      })
      .join("");

    res.type("application/rss+xml").send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>\n<title>SIAHSSR — Recently Published</title>\n<link>${baseUrl}</link>\n<description>Newly published papers from Sai Institute of Arts, Humanities and Social Science Research</description>\n<language>en-us</language>${items}\n</channel></rss>`
    );
  } catch (err) {
    console.error(err);
    res.status(500).type("text/plain").send("Failed to generate feed");
  }
});

// 400/413 friendly error handler (covers multer file-size/type errors too) —
// must stay ahead of the static/catch-all block below so API errors return
// JSON, not the 404 page.
app.use("/api", (err, req, res, next) => {
  console.error(err);
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File is too large" });
  }
  if (err.message && err.message.includes("Only")) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: "Something went wrong on our end" });
});

// ---------- Frontend: plain HTML/CSS/JS, served straight off this server ----------
// `extensions: ["html"]` lets a request for "/about" resolve to about.html,
// so links built elsewhere (e.g. the password-reset email in routes/auth.js,
// which points at `${CLIENT_URL}/reset-password?token=...`) don't need to
// spell out the .html suffix. Every actual page link in the frontend itself
// still uses the explicit .html name.
app.use(express.static(FRONTEND_DIR, { extensions: ["html"] }));

// Anything that reaches here matched no API route and no static file —
// serve the frontend's 404 page instead of Express's bare "Cannot GET ...".
app.use((req, res) => {
  res.status(404).sendFile(path.join(FRONTEND_DIR, "404.html"));
});

const PORT = process.env.PORT || 5000;

// Applies schema.sql (idempotent — safe on every boot) before accepting
// traffic, so pointing this app at a brand-new managed database (Railway,
// Aiven, ...) is enough on its own — no separate "run schema.sql" step.
const runMigrations = require("./database/migrate");
runMigrations()
  .then(() => {
    app.listen(PORT, () => console.log(`SIAHSSR running on port ${PORT} (frontend + API, one origin)`));
  })
  .catch((err) => {
    console.error("Failed to set up the database schema — not starting the server:", err);
    process.exit(1);
  });
