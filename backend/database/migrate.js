const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

// Applies schema.sql to the configured database. Every statement in that file
// is written to be safe to re-run — CREATE TABLE IF NOT EXISTS for every
// table, INSERT ... ON DUPLICATE KEY UPDATE for every seed row (including the
// default admin account) — so calling this on every boot is intentional, not
// just for first-time setup. That removes a manual "load schema.sql" step
// from hosting this app: point it at an empty database (local or a fresh
// managed MySQL like Railway's) and it provisions itself.
//
// Uses its own short-lived connection with multipleStatements enabled (the
// shared pool in config/db.js deliberately leaves that off, since none of
// the app's normal parameterized queries need it — enabling it there would
// only widen the blast radius of a future SQL-building mistake for no
// benefit).

// schema.sql has one section a driver-level connection can't run: the
// "UPGRADE MIGRATION" block wraps a stored procedure in `DELIMITER $$`,
// which is a mysql-CLI-only convention (it tells the *client* to stop
// splitting statements on ';') — mysql2 talks to the server directly and
// has no such concept, so sending that block raises a syntax error right at
// `DELIMITER`. The block exists to backfill columns on a database that
// pre-dates this schema; every CREATE TABLE above it already includes those
// columns, so on the fresh databases this auto-migration runs against, the
// block is a documented no-op anyway (see the comment in schema.sql
// itself). Skip it here; an admin upgrading a genuinely old database still
// runs schema.sql by hand with the mysql CLI, where DELIMITER works
// normally.
const UPGRADE_PROCEDURE_BLOCK =
  /DROP PROCEDURE IF EXISTS siahssr_add_column_if_missing;[\s\S]*?DROP PROCEDURE siahssr_add_column_if_missing;/;

// schema.sql also opens with a hardcoded `CREATE DATABASE IF NOT EXISTS
// siahssr_db ...; USE siahssr_db;`. That's exactly right for the manual
// "run this file with the mysql CLI" setup path, where whatever database
// the file creates IS the one you point the app at. But a hosted managed
// MySQL (Railway, Aiven, ...) hands you an already-provisioned database
// under its own name — DB_NAME won't be "siahssr_db" — so this auto-migrate
// path swaps that header for one built from the actual configured DB_NAME,
// and connects without pinning a database up front so the CREATE DATABASE
// statement itself has somewhere valid to run.
const DB_HEADER =
  /CREATE DATABASE IF NOT EXISTS siahssr_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\nUSE siahssr_db;/;

async function runMigrations() {
  const dbName = process.env.DB_NAME || "siahssr_db";
  if (!/^[A-Za-z0-9_]+$/.test(dbName)) {
    throw new Error(`DB_NAME "${dbName}" isn't a safe SQL identifier (letters, digits, underscore only).`);
  }

  const schemaPath = path.join(__dirname, "schema.sql");
  const sql = fs
    .readFileSync(schemaPath, "utf8")
    .replace(UPGRADE_PROCEDURE_BLOCK, "-- (upgrade-only stored-procedure block skipped for driver-level auto-migration)")
    .replace(
      DB_HEADER,
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\nUSE \`${dbName}\`;`
    );

  // No `database` here on purpose — the CREATE DATABASE/USE pair above (now
  // targeting the real DB_NAME) is what selects it, and that only works if
  // this connection doesn't already require a database to exist yet.
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    multipleStatements: true,
    ...(process.env.DB_SSL === "true" ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  try {
    await connection.query(sql);
    await addMissingColumns(connection, dbName);
    await widenAuthorNameColumns(connection, dbName);
    await relaxSubmissionsPaymentColumns(connection, dbName);
    await seedFaqs(connection);
    await dedupeSeedData(connection);
    console.log(`Database schema is up to date (database: ${dbName}).`);
  } finally {
    await connection.end();
  }
}

// Adds the columns the public no-account submission flow needs to `papers`
// on a database that already had that table (e.g. the live Railway
// database). This was originally written as plain `ALTER TABLE ... ADD
// COLUMN IF NOT EXISTS` in schema.sql, which is valid MySQL 8.0.29+ syntax
// — but Railway's provisioned MySQL rejected it with a syntax error
// (version older than that, apparently), so it's done here instead via an
// information_schema existence check, the same technique the DELIMITER-based
// stored procedure above uses for its own upgrade columns, just in JS so it
// isn't tied to any particular MySQL/MariaDB version. `table`/`column` below
// are always one of the hardcoded literals in NEW_PAPER_COLUMNS, never
// user input, so building the ALTER statement by interpolation is safe.
const NEW_PAPER_COLUMNS = [
  { column: "author_name", definition: "VARCHAR(1000) DEFAULT NULL" },
  { column: "author_designation", definition: "VARCHAR(500) DEFAULT NULL" },
  { column: "author_institute", definition: "TEXT DEFAULT NULL" },
  { column: "author_email", definition: "VARCHAR(150) DEFAULT NULL" },
  { column: "author_contact", definition: "VARCHAR(30) DEFAULT NULL" },
  { column: "submission_id", definition: "INT DEFAULT NULL" },
];

async function addMissingColumns(connection, dbName) {
  const [existingCols] = await connection.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'papers'`,
    [dbName]
  );
  const existing = new Set(existingCols.map((r) => r.COLUMN_NAME));
  for (const { column, definition } of NEW_PAPER_COLUMNS) {
    if (!existing.has(column)) {
      await connection.query(`ALTER TABLE papers ADD COLUMN \`${column}\` ${definition}`);
    }
  }
}

// Real submissions often pack in multiple co-authors with their degrees and
// roles ("1Mr. X, M.A., Ph.D. Research Scholar.  2Dr. Y, ... Associate
// Professor.") into the one "author name" field, since there's nowhere else
// on the form for a second/third author. That easily runs past 150
// characters, which made both `papers.author_name` and
// `submissions.author_name` (and their matching designation columns) throw
// "Data too long for column" and silently fail the admin's "Add Paper" form
// and the public submission form alike. schema.sql's CREATE TABLE already
// reflects the widened columns for a fresh database; this widens them on a
// database that was provisioned before this change, the same
// information_schema-gated MODIFY pattern as relaxSubmissionsPaymentColumns
// below — a no-op once a database is already at (or past) the new width.
const WIDENED_COLUMNS = [
  { table: "papers", column: "author_name", definition: "VARCHAR(1000) DEFAULT NULL", minLength: 1000 },
  { table: "papers", column: "author_designation", definition: "VARCHAR(500) DEFAULT NULL", minLength: 500 },
  { table: "submissions", column: "author_name", definition: "VARCHAR(1000) NOT NULL", minLength: 1000 },
  { table: "submissions", column: "designation", definition: "VARCHAR(500) DEFAULT NULL", minLength: 500 },
];

async function widenAuthorNameColumns(connection, dbName) {
  for (const { table, column, definition, minLength } of WIDENED_COLUMNS) {
    const [rows] = await connection.query(
      `SELECT CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [dbName, table, column]
    );
    if (rows.length === 0) continue; // table/column doesn't exist yet — nothing to widen
    const currentLength = rows[0].CHARACTER_MAXIMUM_LENGTH;
    if (currentLength === null || currentLength < minLength) {
      await connection.query(`ALTER TABLE \`${table}\` MODIFY \`${column}\` ${definition}`);
    }
  }
}

// The public paper-submission form used to require a ₹899 UPI payment
// (reference number + confirmation checkbox) before it would unlock, and
// `submissions.payment_reference`/`payment_amount` were NOT NULL to match.
// That payment step was removed from the form at the site owner's request,
// so the code stopped sending those two fields on INSERT — which would
// otherwise fail with a "doesn't have a default value" error against a
// database created before this change. This makes both columns nullable
// on boot (schema.sql's own CREATE TABLE already reflects the new,
// nullable definition for anyone provisioning a fresh database — this is
// only for a database that already exists with the old NOT NULL columns).
// information_schema-gated so it's a no-op once a database has already
// been relaxed. Old paid submissions keep their stored reference/amount;
// only the constraint changes, not the data.
const RELAXED_PAYMENT_COLUMNS = [
  { column: "payment_reference", definition: "VARCHAR(150) DEFAULT NULL" },
  { column: "payment_amount", definition: "DECIMAL(10,2) DEFAULT NULL" },
];

async function relaxSubmissionsPaymentColumns(connection, dbName) {
  const [rows] = await connection.query(
    `SELECT COLUMN_NAME, IS_NULLABLE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'submissions'
       AND COLUMN_NAME IN ('payment_reference', 'payment_amount')`,
    [dbName]
  );
  const nullableByColumn = new Map(rows.map((r) => [r.COLUMN_NAME, r.IS_NULLABLE === "YES"]));
  for (const { column, definition } of RELAXED_PAYMENT_COLUMNS) {
    // Only ALTER a column that exists and is still NOT NULL — skips cleanly
    // on a database that doesn't have the `submissions` table yet (schema.sql
    // above just created it nullable already) and on one already relaxed.
    if (nullableByColumn.has(column) && nullableByColumn.get(column) === false) {
      await connection.query(`ALTER TABLE submissions MODIFY \`${column}\` ${definition}`);
    }
  }
}

// The FAQ page (frontend-html/js/pages/faq.js) was live but empty — `faqs`
// had no seed data and nobody had added any from the admin dashboard yet.
// This seeds 15 starter questions the first time the app boots against a
// database with zero rows in `faqs`, gated on COUNT(*) = 0 rather than a
// unique-key/ON-DUPLICATE-KEY pattern (see the dedupeSeedData comment below
// for why those don't fit this codebase's seed tables) — simpler, and safe
// because it only ever fires once: any row at all, whether from this seed or
// an admin's own addition, permanently turns it into a no-op. Grounded in
// the site's actual current settings/guidelines (public/settings row and
// guidelines_text) rather than invented policy, so nothing here contradicts
// what the rest of the site already tells a visitor.
const FAQ_SEED = [
  ["What is SIAHSSR?", "SIAHSSR (Sai Institute of Arts, Humanities and Social Science Research) publishes peer-reviewed academic journals covering development studies, the social sciences, and related interdisciplinary research areas.", "General", 1],
  ["What journals does SIAHSSR publish?", "Our current journals, along with each one's scope and call for papers, are listed on the Journals page. New journals are added from time to time as the institute's research areas grow.", "General", 2],
  ["Is there a submission or publication fee?", "No. There is currently no charge to submit or publish a paper with SIAHSSR.", "General", 3],
  ["Are published papers freely available to read?", "Yes. Published papers are openly accessible on the Papers Archive at no cost to readers.", "General", 4],
  ["Can I cite a published paper, and in what formats?", "Yes — every published paper's page includes a ready-made APA citation, plus BibTeX and RIS downloads for reference managers.", "General", 5],
  ["Who do I contact if I have a question that isn't answered here?", "Reach out through the Contact page, or email us directly — our details are listed there.", "General", 6],
  ["Do I need an account to submit a paper?", "No. Submissions go through a simple form on the Submit a Paper page — just fill in your details, select the journal, and upload your manuscript. No login or registration is required.", "Submission", 1],
  ["What file format should I submit my manuscript in?", "Manuscripts must be submitted as a Word document (.docx). Other formats, including PDF, are not accepted through the public submission form.", "Submission", 2],
  ["What is the word limit for a submission?", "Manuscripts should be original, unpublished work between 3,000 and 8,000 words.", "Submission", 3],
  ["What should the abstract include?", "Include a 150–250 word abstract along with 4–6 keywords that describe your paper's subject and scope.", "Submission", 4],
  ["What citation/referencing style is required?", "References should follow APA style throughout the manuscript.", "Submission", 5],
  ["How are submissions evaluated?", "Every submission is reviewed for originality, methodology, clarity, and overall significance before an accept or reject decision is made.", "Submission", 6],
  ["How will I know the outcome of my submission?", "The editorial team gets in touch using the email address you provide on the submission form once a decision has been made.", "Submission", 7],
  ["Can I submit a paper that has already been published elsewhere?", "No — submissions must be original, unpublished work that isn't currently under review with another journal.", "Submission", 8],
  ["Can a paper have more than one author?", "Yes. If your paper has co-authors, list all of them along with their designations and affiliations in the author details you provide with your submission.", "Submission", 9],
];

async function seedFaqs(connection) {
  const [[{ count }]] = await connection.query(`SELECT COUNT(*) AS count FROM faqs`);
  if (count > 0) return;
  await connection.query(
    `INSERT INTO faqs (question, answer, category, sort_order) VALUES ?`,
    [FAQ_SEED]
  );
}

// schema.sql's default-seed INSERTs for journals/about_items/documents use
// `ON DUPLICATE KEY UPDATE` (or, for about_items/documents, nothing at all)
// as their only safety net, but none of those three tables actually has a
// unique key on the seed rows' natural identity (short_name / (section,
// text) / title) — so on every restart, this file's own seed statements
// were quietly re-inserting a fresh duplicate set instead of updating
// nothing. Adding a real unique constraint would also block an admin from
// ever legitimately adding a second document or about-page item with the
// same title/text, so instead of constraining the table, this just cleans
// up after every boot: keep the lowest id in each duplicate group (the
// original row), repoint anything that pointed at a since-created
// duplicate journal (papers/submissions/editorial_board — journals is the
// only one of the three with real foreign keys pointing at it, and its FK
// is ON DELETE CASCADE, so skipping the repoint would delete real
// papers/submissions along with the duplicate journal), then delete the
// duplicates. Safe and cheap to run on every boot even once there's
// nothing left to dedupe.
async function dedupeSeedData(connection) {
  const [journalDupes] = await connection.query(
    `SELECT short_name, MIN(id) AS keep_id, GROUP_CONCAT(id) AS all_ids
     FROM journals GROUP BY short_name HAVING COUNT(*) > 1`
  );
  for (const { keep_id, all_ids } of journalDupes) {
    const dupeIds = all_ids.split(",").map(Number).filter((id) => id !== keep_id);
    if (dupeIds.length === 0) continue;
    await connection.query(`UPDATE papers SET journal_id = ? WHERE journal_id IN (?)`, [keep_id, dupeIds]);
    await connection.query(`UPDATE submissions SET journal_id = ? WHERE journal_id IN (?)`, [keep_id, dupeIds]);
    await connection.query(`UPDATE editorial_board SET journal_id = ? WHERE journal_id IN (?)`, [keep_id, dupeIds]);
    await connection.query(`DELETE FROM journals WHERE id IN (?)`, [dupeIds]);
  }

  const [aboutDupes] = await connection.query(
    `SELECT MIN(id) AS keep_id, GROUP_CONCAT(id) AS all_ids
     FROM about_items GROUP BY section, LEFT(text, 255) HAVING COUNT(*) > 1`
  );
  for (const { keep_id, all_ids } of aboutDupes) {
    const dupeIds = all_ids.split(",").map(Number).filter((id) => id !== keep_id);
    if (dupeIds.length > 0) await connection.query(`DELETE FROM about_items WHERE id IN (?)`, [dupeIds]);
  }

  const [documentDupes] = await connection.query(
    `SELECT MIN(id) AS keep_id, GROUP_CONCAT(id) AS all_ids
     FROM documents GROUP BY title, file_path HAVING COUNT(*) > 1`
  );
  for (const { keep_id, all_ids } of documentDupes) {
    const dupeIds = all_ids.split(",").map(Number).filter((id) => id !== keep_id);
    if (dupeIds.length > 0) await connection.query(`DELETE FROM documents WHERE id IN (?)`, [dupeIds]);
  }
}

module.exports = runMigrations;
