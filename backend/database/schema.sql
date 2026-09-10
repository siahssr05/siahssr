-- SIAHSSR Database Schema
-- Run this file first to create the database and all tables

CREATE DATABASE IF NOT EXISTS siahssr_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE siahssr_db;

-- ========== USERS ==========
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('author','reviewer','admin') NOT NULL DEFAULT 'author',
  affiliation VARCHAR(255) DEFAULT NULL,
  photo_path VARCHAR(255) DEFAULT NULL,
  orcid VARCHAR(19) DEFAULT NULL,
  reset_token VARCHAR(255) DEFAULT NULL,
  reset_token_expires DATETIME DEFAULT NULL,
  last_login DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Default admin account — email/password as provided by the institute.
-- Log in at /login-admin.html with siahssr05@gmail.com / siahssr05 (change the
-- password from the admin dashboard, or a fresh INSERT with a new bcrypt hash,
-- whenever you'd like). Safe to re-run: ON DUPLICATE KEY UPDATE is a no-op if
-- this account already exists.
INSERT INTO users (name, email, password, role) VALUES
 ('SIAHSSR Admin', 'siahssr05@gmail.com', '$2a$10$5VVD8SgYzmx6ubNxqQeBb.XRzxSyqxHYYHLNqQmVWgfj/S7OJ8euC', 'admin')
ON DUPLICATE KEY UPDATE name=name;

-- ========== JOURNALS ==========
CREATE TABLE IF NOT EXISTS journals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  short_name VARCHAR(50) NOT NULL,
  issn VARCHAR(20) DEFAULT NULL,
  description TEXT,
  logo_path VARCHAR(255) DEFAULT NULL,
  current_volume VARCHAR(20) DEFAULT NULL,
  current_issue VARCHAR(20) DEFAULT NULL,
  cfp_text TEXT,
  cfp_deadline DATE DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ========== PAPERS ==========
-- author_id is nullable and abstract is nullable: papers can now come from
-- either the (legacy) author-account flow (author_id set, users JOIN works)
-- or the public no-account submission flow (author_id NULL, the author_*
-- columns below carry the details directly, and admin fills in the abstract
-- when publishing). Every query that displays an author name should
-- COALESCE(u.name, p.author_name) with a LEFT JOIN on users, not an INNER
-- JOIN, so both kinds of papers render correctly.
CREATE TABLE IF NOT EXISTS papers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  abstract TEXT DEFAULT NULL,
  keywords VARCHAR(500) DEFAULT NULL,
  author_id INT DEFAULT NULL,
  author_name VARCHAR(1000) DEFAULT NULL,
  author_designation VARCHAR(500) DEFAULT NULL,
  author_institute TEXT DEFAULT NULL,
  author_email VARCHAR(150) DEFAULT NULL,
  author_contact VARCHAR(30) DEFAULT NULL,
  submission_id INT DEFAULT NULL,
  journal_id INT NOT NULL,
  volume VARCHAR(20) DEFAULT NULL,
  issue VARCHAR(20) DEFAULT NULL,
  status ENUM('submitted','under_review','accepted','rejected','published','withdrawn') NOT NULL DEFAULT 'submitted',
  file_path VARCHAR(255) DEFAULT NULL,
  original_filename VARCHAR(255) DEFAULT NULL,
  receipt_path VARCHAR(255) DEFAULT NULL,
  reviewer_id INT DEFAULT NULL,
  reviewer_status ENUM('pending','accepted','declined') DEFAULT NULL,
  review_comments TEXT,
  score_originality TINYINT DEFAULT NULL,
  score_methodology TINYINT DEFAULT NULL,
  score_clarity TINYINT DEFAULT NULL,
  score_significance TINYINT DEFAULT NULL,
  doi VARCHAR(150) DEFAULT NULL,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  published_at DATETIME DEFAULT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (journal_id) REFERENCES journals(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ========== SUBMISSIONS ==========
-- Public, no-account paper submissions: a visitor pays the ₹899 fee via the
-- UPI QR/VPA shown on the Submit a Paper page, self-declares the payment
-- (checkbox + their UPI transaction/reference number — no payment gateway
-- is wired up, see submit-paper.html for why), then uploads their .docx and
-- fills in these 7 fields. Every submission lands here AND is emailed to
-- editorijdssr@gmail.com with the file attached, so admin has both a record
-- to manage from the dashboard and a copy in the inbox. Publishing a
-- submission (admin action) creates a row in `papers` and links back here
-- via published_paper_id.
CREATE TABLE IF NOT EXISTS submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  author_name VARCHAR(1000) NOT NULL,
  designation VARCHAR(500) DEFAULT NULL,
  institute_address TEXT NOT NULL,
  email VARCHAR(150) NOT NULL,
  title VARCHAR(500) NOT NULL,
  contact_no VARCHAR(30) NOT NULL,
  journal_id INT DEFAULT NULL,
  file_path VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  payment_reference VARCHAR(150) NOT NULL,
  payment_amount DECIMAL(10,2) NOT NULL DEFAULT 899.00,
  status ENUM('new','reviewed','published','rejected') NOT NULL DEFAULT 'new',
  admin_notes TEXT,
  published_paper_id INT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (journal_id) REFERENCES journals(id) ON DELETE SET NULL,
  FOREIGN KEY (published_paper_id) REFERENCES papers(id) ON DELETE SET NULL
);

-- ========== EDITORIAL BOARD ==========
CREATE TABLE IF NOT EXISTS editorial_board (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  designation VARCHAR(255) DEFAULT NULL,
  affiliation VARCHAR(255) DEFAULT NULL,
    photo_path VARCHAR(255) DEFAULT NULL,
  bio TEXT,
  expertise VARCHAR(255) DEFAULT NULL,
  email VARCHAR(150) DEFAULT NULL,
  phone VARCHAR(30) DEFAULT NULL,
  journal_id INT DEFAULT NULL,
  sort_order INT DEFAULT 0,
  FOREIGN KEY (journal_id) REFERENCES journals(id) ON DELETE SET NULL
);

-- ========== ABOUT PAGE CONTENT (core values / objectives / mission — all bulleted lists) ==========
CREATE TABLE IF NOT EXISTS about_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  section ENUM('core_value','objective','mission') NOT NULL,
  text TEXT NOT NULL,
  sort_order INT DEFAULT 0
);

-- ========== DOCUMENTS (institute brochures, policy docs, etc. — uploaded & stored via DB) ==========
CREATE TABLE IF NOT EXISTS documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) DEFAULT 'general',
  file_path VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  uploaded_by INT DEFAULT NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ========== FAQ ==========
CREATE TABLE IF NOT EXISTS faqs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  question VARCHAR(500) NOT NULL,
  answer TEXT NOT NULL,
  category VARCHAR(100) DEFAULT 'general',
  sort_order INT DEFAULT 0
);

-- ========== ANNOUNCEMENTS (Home page) ==========
CREATE TABLE IF NOT EXISTS announcements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ========== SITE SETTINGS (editable homepage/about/contact text) ==========
CREATE TABLE IF NOT EXISTS site_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value TEXT,
  updated_by INT DEFAULT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Default settings
INSERT INTO site_settings (setting_key, setting_value) VALUES
 ('site_logo', '/uploads/logos/site-logo.png'),
 ('hero_title', 'Sai Institute of Arts, Humanities and Social Science Research'),
 ('hero_subtitle', 'Research, Innovation and Social Transformation'),
 ('tagline', 'Research, Innovation and Social Transformation'),
 ('vision_text', 'To become a globally recognised centre of excellence in arts, humanities, and social science research by fostering innovation, academic excellence, ethical values, and sustainable societal development through interdisciplinary research, education, and collaboration.'),
 ('contact_phone_1', '+91 96002 82239'),
 ('contact_phone_2', '+91 63830 63291'),
 ('contact_email', 'siahssr05@gmail.com'),
 ('contact_address', 'No. 26/1, Thabalkaar Anumatha Gounder Street, Reddiyur Post, Jolarpettai'),
 ('guidelines_text', 'Manuscripts should be original, unpublished work between 3,000-8,000 words, submitted as a Word (.docx) file with a title, abstract (150-250 words), 4-6 keywords, and references in APA style. Submissions are reviewed for originality, methodology, clarity, and significance before an accept/reject decision. Editable from the admin Site Content tab.')
ON DUPLICATE KEY UPDATE setting_key=setting_key;

-- Default About page content (from the institute's official Objectives / Mission / Vision document)
INSERT INTO about_items (section, text, sort_order) VALUES
 ('core_value', 'Academic Excellence', 1),
 ('core_value', 'Integrity and Ethics', 2),
 ('core_value', 'Innovation and Creativity', 3),
 ('core_value', 'Inclusiveness and Diversity', 4),
 ('core_value', 'Collaboration', 5),
 ('core_value', 'Professionalism', 6),
 ('core_value', 'Social Responsibility', 7),
 ('core_value', 'Sustainability', 8),
 ('core_value', 'Lifelong Learning', 9),
 ('core_value', 'Service to Humanity', 10),

 ('objective', 'To promote quality research, innovation, and academic excellence in the fields of Arts, Humanities, Social Sciences, and allied disciplines.', 1),
 ('objective', 'To collaborate with Central Government, State Government, Local Self-Government Institutions, Public Sector Organizations, Universities, Research Institutions, NGOs, and International Organizations for research, training, policy development, and community outreach.', 2),
 ('objective', 'To undertake government-funded research projects, surveys, impact assessments, socio-economic studies, policy evaluations, and consultancy assignments.', 3),
 ('objective', 'To organize international and national conferences, seminars, workshops, faculty development programmes, certificate courses, and training programmes.', 4),
 ('objective', 'To publish peer-reviewed journals, edited books, conference proceedings, policy papers, newsletters, and research reports.', 5),
 ('objective', 'To promote interdisciplinary and multidisciplinary research addressing national and global developmental challenges.', 6),
 ('objective', 'To provide research guidance, capacity-building programmes, internships, and skill-development initiatives for students, scholars, teachers, government officials, and professionals.', 7),
 ('objective', 'To establish academic partnerships and Memoranda of Understanding (MoUs) with universities, government departments, industries, and civil society organizations.', 8),
 ('objective', 'To promote evidence-based policymaking through research findings and recommendations for sustainable development.', 9),
 ('objective', 'To encourage innovation, entrepreneurship, digital transformation, and technology-enabled research for societal development.', 10),
 ('objective', 'To facilitate national and international research collaborations, exchange programmes, and knowledge-sharing initiatives.', 11),
 ('objective', 'To uphold the highest standards of academic integrity, ethical research practices, inclusiveness, gender equality, and social justice.', 12),
 ('objective', 'To contribute towards the achievement of the United Nations Sustainable Development Goals (SDGs) through impactful research, education, and community engagement.', 13),
 ('objective', 'To establish centres of excellence, research laboratories, knowledge resource centres, and digital repositories for advancing research and innovation.', 14),
 ('objective', 'To recognize and support outstanding researchers through fellowships, awards, memberships, and research grants.', 15),
 ('objective', 'To collaborate with Government Departments including the Ministries of the Government of India, Government of Tamil Nadu, Municipal Corporations, Panchayati Raj Institutions, District Administration, Public Health Departments, Educational Institutions, and other statutory bodies for research, policy formulation, monitoring and evaluation, capacity building, and implementation of developmental programmes.', 16),

 ('mission', 'To promote high-quality and ethical research in Arts, Humanities, and Social Sciences.', 1),
 ('mission', 'To encourage interdisciplinary and collaborative research addressing contemporary societal challenges.', 2),
 ('mission', 'To organise international conferences, seminars, workshops, faculty development programmes, and training programmes.', 3),
 ('mission', 'To publish peer-reviewed journals, edited books, conference proceedings, and research monographs.', 4),
 ('mission', 'To strengthen collaboration among researchers, universities, industries, government organisations, and policymakers.', 5),
 ('mission', 'To support young researchers through mentoring, skill development, and research guidance.', 6),
 ('mission', 'To promote innovation, inclusiveness, sustainability, and social responsibility in research and education.', 7),
 ('mission', 'To contribute to evidence-based policymaking and community development through impactful research.', 8)
ON DUPLICATE KEY UPDATE section=section;

-- Default documents (the institute's official Objectives/Mission/Vision document, stored and DB-tracked)
INSERT INTO documents (title, category, file_path, original_filename) VALUES
 ('Objectives, Mission & Vision', 'institute', '/uploads/documents/siahssr-objectives-mission-vision.pdf', 'Sai_Institute_of_Arts_Objectives_Mission_Vision.pdf')
ON DUPLICATE KEY UPDATE title=title;

-- Default journals
INSERT INTO journals (name, short_name, issn, description, current_volume, current_issue, cfp_text, cfp_deadline) VALUES
 ('International Journal of Development and Social Sciences Research', 'IJDSSR', NULL,
  'A peer-reviewed journal publishing original research across development studies and the social sciences.',
  '1', '1', 'Submissions open for the upcoming issue. We welcome original research, reviews, and case studies.', NULL)
ON DUPLICATE KEY UPDATE name=name;

-- ========== CONTACT MESSAGES (submitted via the public Contact page form) ==========
CREATE TABLE IF NOT EXISTS contact_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL,
  subject VARCHAR(255) DEFAULT NULL,
  message TEXT NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ========== EVENTS & NEWS (conferences, workshops, training programmes, CFPs) ==========
CREATE TABLE IF NOT EXISTS events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_type ENUM('conference','workshop','training','seminar','other') NOT NULL DEFAULT 'other',
  event_date DATE DEFAULT NULL,
  location VARCHAR(255) DEFAULT NULL,
  created_by INT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ========== ADMIN AUDIT LOG (who did what, for accountability) ==========
CREATE TABLE IF NOT EXISTS audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT DEFAULT NULL,
  action VARCHAR(150) NOT NULL,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ========== NOTICES (image-based notice board, shown on the homepage) ==========
CREATE TABLE IF NOT EXISTS notices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  image_path VARCHAR(255) NOT NULL,
  posted_by INT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (posted_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ========== UPGRADE MIGRATION (safe to re-run — adds columns only if missing) ==========
-- Covers databases created before peer-review scores, reviewer accept/decline,
-- ORCID, last_login, and the 'withdrawn' paper status were added. On a brand
-- new database the CREATE TABLE statements above already include these
-- columns, so every block below is a harmless no-op there.

DROP PROCEDURE IF EXISTS siahssr_add_column_if_missing;
DELIMITER $$
CREATE PROCEDURE siahssr_add_column_if_missing(
  IN p_table VARCHAR(64), IN p_column VARCHAR(64), IN p_definition VARCHAR(255)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_column
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE ', p_table, ' ADD COLUMN ', p_column, ' ', p_definition);
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

CALL siahssr_add_column_if_missing('users', 'orcid', 'VARCHAR(19) DEFAULT NULL');
CALL siahssr_add_column_if_missing('users', 'last_login', 'DATETIME DEFAULT NULL');
CALL siahssr_add_column_if_missing('papers', 'reviewer_status', "ENUM('pending','accepted','declined') DEFAULT NULL");
CALL siahssr_add_column_if_missing('papers', 'score_originality', 'TINYINT DEFAULT NULL');
CALL siahssr_add_column_if_missing('papers', 'score_methodology', 'TINYINT DEFAULT NULL');
CALL siahssr_add_column_if_missing('papers', 'score_clarity', 'TINYINT DEFAULT NULL');
CALL siahssr_add_column_if_missing('papers', 'score_significance', 'TINYINT DEFAULT NULL');

DROP PROCEDURE siahssr_add_column_if_missing;

-- Re-stating the same ENUM (with 'withdrawn' added) is always safe to run again.
ALTER TABLE papers MODIFY COLUMN status
  ENUM('submitted','under_review','accepted','rejected','published','withdrawn')
  NOT NULL DEFAULT 'submitted';

-- ========== UPGRADE MIGRATION: public no-account submission flow ==========
-- Adds the columns needed for admin-only auth + public pay-then-submit
-- papers to a database that already exists (e.g. the live Railway
-- database, created before this feature existed). `ADD COLUMN IF NOT
-- EXISTS` would be the natural way to write this (and is valid on MySQL
-- 8.0.29+), but Railway's provisioned MySQL rejected it with a syntax
-- error — so those columns are added from migrate.js instead, via a plain
-- information_schema existence check (same technique the DELIMITER-based
-- stored procedure above uses, just in JS instead of SQL, so it works on
-- any MySQL/MariaDB version). See database/migrate.js's addMissingColumns.

-- Existing rows all already have a real author_id/abstract, so relaxing
-- these to nullable (so the no-account flow can leave them NULL) is always
-- safe to re-run.
ALTER TABLE papers MODIFY COLUMN author_id INT DEFAULT NULL;
ALTER TABLE papers MODIFY COLUMN abstract TEXT DEFAULT NULL;
