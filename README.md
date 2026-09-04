# SIAHSSR — Sai Institute of Arts, Humanities and Social Science Research

A full-stack academic journal website: public site + author submission portal + reviewer
workflow + admin CMS, built for the IJDSSR and JMRH journals.

Tested end-to-end on this build: register → login (no email verification step — an account
can log in immediately after signing up) → submit paper (Word .docx upload) →
auto-generated letterhead submission receipt as a real **.docx** file (journal name on
every page header, page numbers in the footer) → admin review → publish → live on the
public Papers Archive and homepage stats.

Every document in this system — the submission receipt and the admin-managed Institute
Documents — is a Word **.docx** file. There is no PDF generation or PDF upload anywhere
in the codebase.

---

## Tech Stack

- **Frontend:** Plain HTML + CSS + vanilla JavaScript (multi-page — one real `.html` file
  per screen, no build step, no framework), Bootstrap 5 loaded from a CDN `<link>` for
  layout/components
- **Backend:** Node.js + Express — now also serves the frontend directly, so the whole
  site is one process on one origin (see `frontend-html/` below)
- **Database:** MySQL (mysql2)
- **Auth:** JWT (httpOnly cookie + bearer token fallback), bcrypt password hashing
- **File handling:** Multer (papers, board photos, logos, notice images, institute
  documents), `docx` (submission receipts — real Word files, not PDF)

> **Note on `frontend/`:** this repo also still contains the original React + Vite build
> in `frontend/`. It's no longer used — the backend now serves `frontend-html/` instead
> (see below) — and is kept only so nothing is deleted out from under you. Once you've
> confirmed the new plain-HTML site works the way you want, that folder is safe to remove.

---

## Setup

### 1. Database
```bash
mysql -u root -p < backend/database/schema.sql
```
This creates the `siahssr_db` database, all 11 tables, and seeds default journals + site
settings **plus a ready-to-use admin account** (see below). Reference queries for every
feature are in `backend/database/queries.sql`. Running this against an existing database
is safe to re-run any time — every `CREATE TABLE` uses `IF NOT EXISTS`, every seed `INSERT`
uses `ON DUPLICATE KEY UPDATE`, and a migration block at the end of the file adds any
columns a previous run of this file didn't have yet (peer-review scores, reviewer
accept/decline, ORCID, last-login, the `withdrawn` paper status) without touching your
existing data. It uses a temporary stored procedure to check column existence, which it
drops again once done.

### 2. Backend (this also serves the frontend — one command runs the whole site)
```bash
cd backend
cp .env.example .env       # edit DB_PASSWORD, JWT_SECRET, CLIENT_URL before deploying
npm install
npm run dev                # http://localhost:5000 — frontend AND API, same origin
```
There's no separate frontend step and nothing to build: `frontend-html/` is plain
HTML/CSS/JS, and `server.js` serves it with `express.static` alongside the `/api/*`
routes. Open `http://localhost:5000` in a browser and the whole site — public pages,
login, dashboards, admin — is right there.

### First admin account
`schema.sql` already seeds one admin account, ready to use as soon as the database is
created — log in at `/login-admin.html` with:
- **Email:** `siahssr05@gmail.com`
- **Password:** `siahssr05`

Change that password from the admin dashboard (or with a fresh `UPDATE`) once you're in.
Registration itself only ever creates `author`/`reviewer` accounts (by design — admins
aren't self-service), so to add another admin, insert one directly:
```sql
-- generate a bcrypt hash first: node -e "console.log(require('bcryptjs').hashSync('yourpassword', 10))"
INSERT INTO users (name, email, password, role)
VALUES ('Admin Name', 'admin@yourdomain.com', '<paste bcrypt hash>', 'admin');
```

---

## Frontend structure (`frontend-html/`)

Every screen is its own real `.html` file — normal links between pages, no client-side
router to maintain:

```
frontend-html/
  index.html, about.html, journals.html, papers.html, ...   ← one file per page
  dashboard-author.html, dashboard-reviewer.html, dashboard-admin.html
  css/theme.css              ← the site's navy/gold/cream theme (plain CSS)
  js/api.js                  ← fetch wrapper + login/logout/session helpers
  js/utils.js                ← shared helpers (escaping, pagination, formatting, SEO tags)
  js/captcha.js, js/charts.js
  js/partials.js             ← loads the shared navbar/footer into every page
  js/pages/*.js               ← one script per page, matching its .html file
  partials/navbar.html, partials/footer.html
```

A couple of things worth knowing if you extend this:

- **Auth** stays cookie-based (same as before) since the frontend and API now share an
  origin — no CORS workaround needed. A copy of the logged-in user + token is also kept
  in `localStorage` purely so pages can render "logged in as X" instantly and the
  session-timeout banner can read the token's expiry client-side.
- **Escaping:** unlike React, nothing here auto-escapes text into HTML. Every page's JS
  routes dynamic content through the `esc()` helper in `js/utils.js` before it lands in a
  template string — keep doing that for anything sourced from the database or a form.
- **Protected pages** (`submit-paper.html`, the three `dashboard-*.html` files) call
  `requireRole([...])` at the top of their script, which redirects instantly if no one's
  logged in or the role doesn't match. The real enforcement is still server-side, exactly
  as before — this is just what keeps the page from flashing content it shouldn't.
- Requesting a page without its `.html` suffix (e.g. `/about`) still works — the backend's
  static file serving resolves it automatically.

---

## What's included

- Public site: Home (with a **Notice Board sidebar** of admin-posted notice images and
  a **5-tile live stats row** — Published Papers, Active Journals, Peer Reviewers,
  Authors, Board Members), About (objectives), Journals (with per-journal logo + CFP),
  Papers Archive (search/filter, plus a **Browse by Volume/Issue** view), single Paper
  view (now linking to a **public author profile** page), Editorial Board,
  **Events & News**, **Author Guidelines** page, FAQ, Contact (**working message form**)
- A **quick search box in the navbar** on every page — searches the Papers Archive by
  title/keyword and lands on the results, no need to visit Papers first
- A single Paper view now has a **Print button** (print-only masthead, navbar/footer/
  buttons hidden via Bootstrap's print utilities, the citation block stays visible on
  the printed page) and a **"More from this journal"** related-papers strip
- An **RSS feed at `/feed.xml`** lists the 30 most recently published papers, linked
  from the homepage/Papers page `<head>` and a footer link, for any feed reader
- A **modern split-screen login/register/forgot-password/reset-password design**
  (branding panel + card form, icon-prefixed inputs, password show/hide) shared across
  all three role logins, sign-up, and password recovery
- Author: register and log in right away — no email verification step (with an optional
  **ORCID** field), submit paper (Word .docx), view own submissions + statuses, **edit or
  withdraw a submission while it's still unassigned**, download own submission receipt,
  download a **Certificate of Publication (.docx)** once a paper is published, **gets an
  email when a submission's status changes** (under review / accepted / rejected /
  published)
- Reviewer: gets emailed when assigned a paper and must **accept or decline** the
  assignment before it counts as "under review" (declining returns it to the pool);
  once accepted, scores each paper on a **4-criterion rubric** (originality,
  methodology, clarity, significance) alongside free-text comments
- Admin: manage users (roles, showing **ORCID + last login**), manage
  papers (assign reviewer, publish, delete), manage journals (incl. logo upload), manage
  editorial board (incl. photo upload), manage FAQ, manage homepage announcements,
  manage **Events & News**, manage the **Notice Board** (post a title + image, shown on
  the homepage sidebar newest-first, delete anytime), read **contact form messages**,
  review an **audit log** of admin actions, view an **Analytics tab**
  (submissions/publications over time, status breakdown, per-journal totals, most active
  reviewers), edit site settings (hero text, contact info, **navbar logo**, **author
  guidelines text**), edit About page objectives, upload **Institute Documents (.docx
  only)** for public download.
  The Users, Papers, and Audit Log tables are **paginated**, and Users/Papers/Messages
  each have a **CSV export** button. Deleting a user/paper/event now requires **typing a
  confirmation word**, not just clicking through a popup.
- A **session-timeout warning banner** appears site-wide a few minutes before a logged-in
  user's JWT expires, with a one-click logout.
- Every paper submission auto-generates a **.docx receipt** with the **journal name in
  a gold-accented header on every page** and a **"Page X of Y" + journal name footer on
  every page**, built with live Word page-number fields
- Once published, authors can download a **Certificate of Publication (.docx)** —
  a keepsake letterhead document with the paper title, author, journal, volume/issue,
  publish date, ISSN and DOI (when set)
- Published papers offer **citation export** (BibTeX / RIS download + a copy-to-clipboard
  APA citation) and carry **JSON-LD `ScholarlyArticle` structured data** + per-page meta
  tags for search engine / Google Scholar crawling
- A generated **`/sitemap.xml`** and **`/robots.txt`** (served by the backend) list every
  public page, journal, and published paper
- Download endpoints for papers and receipts, access-controlled by role/ownership

## Security notes already handled

- Passwords hashed with bcrypt (never stored plain)
- Login never reveals whether an email exists (generic error)
- Rate limiting on login, register, contact, and paper submission, plus a baseline
  rate limit across the whole `/api`
- A **dependency-free math captcha** (no external keys needed) on the register, submit
  paper, and contact forms — stateless HMAC-signed tokens, no server-side session storage
- An **admin audit log** records role changes, user deletion, reviewer assignment, paper
  publish/delete, and event create/delete, with who did it and when
- Destructive admin actions (delete user/paper/event) require **typing a confirmation
  word**, not just clicking through a popup
- JWT with expiry; httpOnly cookie option; a client-side session-timeout banner warns
  before a token expires (the server independently enforces the real expiry regardless)
- File-type and file-size validation on all uploads (.docx for papers, receipts and
  institute documents; images for logos/photos/notices) — **no PDFs are accepted or
  generated anywhere in this system**

---

## How this compares to industry-standard journal platforms

The closest real-world equivalent is **Open Journal Systems (OJS)**, the open-source
platform used by 20,000+ journals worldwide, and commercial platforms like Scholastica.

| Feature | OJS / Scholastica | This build |
|---|---|---|
| Submission workflow | Yes, highly configurable | Yes — title/abstract/keywords/Word doc |
| Peer review assignment | Yes, blind/double-blind options | Yes — reviewer assignment + status/comments |
| Role-based access (author/reviewer/editor) | Yes | Yes — author/reviewer/admin |
| DOI / Crossref integration | Automated, live registration | DOI field stored, manual entry (no live registry call) |
| Multi-journal hosting | Yes | Yes — IJDSSR + JMRH, extensible |
| Branded submission receipts with letterhead | Not a standard OJS feature | Yes — a real .docx with a letterhead header, numbered footer on every page |
| Admin content management (logos, board, FAQ, home content) | Partial, theme-dependent | Yes — full CMS covered by this build |
| Citation export (BibTeX/RIS) | Yes | Yes |
| Indexing readiness (Google Scholar, DOAJ, PubMed) | Yes, built-in, with registry submission | JSON-LD structured data, meta tags, sitemap.xml — the crawlable groundwork is in; live registry submission (DOAJ/PubMed applications) is still a manual step outside any codebase |
| Admin analytics/reporting | Yes | Yes — submissions/publications over time, status & journal breakdowns |
| Audit trail of admin actions | Yes | Yes |
| Structured peer-review scoring | Yes, configurable rubrics | Yes — a fixed 4-criterion rubric (originality/methodology/clarity/significance) |
| Reviewer accept/decline before review starts | Yes | Yes |
| Author self-service (edit/withdraw before review) | Yes | Yes — while still unassigned to a reviewer |
| Author profile pages / ORCID | Yes | Yes |

For a final-year project or competition entry, this build covers the full core
workflow a real journal needs, plus the SEO/indexing groundwork, analytics, and
audit trail that used to be the main gap versus OJS. What's left versus a production
OJS deployment is mostly external integrations that need real-world accounts/keys
(live DOI registration with Crossref, actual DOAJ/PubMed indexing applications) and
years of production hardening — not anything the codebase itself is missing.
