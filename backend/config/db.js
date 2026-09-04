const mysql = require("mysql2/promise");
require("dotenv").config();

// Works fine with an empty DB_PASSWORD for local dev.
// For production, set a real password in .env and never commit it.
//
// DB_PORT / DB_SSL exist for hosted MySQL (Railway, Aiven, PlanetScale, etc.) —
// most managed databases listen on a non-default port and require TLS, which
// a bare localhost setup never needs. Leave both unset for local dev.
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "siahssr_db",
  charset: "utf8mb4",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ...(process.env.DB_SSL === "true" ? { ssl: { rejectUnauthorized: false } } : {}),
});

// No eager connectivity check here on purpose: on a brand-new deploy the
// database itself doesn't exist yet until database/migrate.js creates it
// (see server.js), so a check made at module-load time — before that has
// run — would always fail on a fresh install and log a scary but harmless
// error. server.js's own "Database schema is up to date" / "SIAHSSR
// running on port ..." lines are the real signal that the database is
// reachable and ready.

module.exports = pool;
