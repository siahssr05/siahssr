-- SIAHSSR — Reference queries used across the app (also handy for manual DB checks)

-- ===== AUTH =====
-- Find user by email (login)
SELECT * FROM users WHERE email = ?;

-- Create user (register) — no email verification step; accounts can log in immediately
INSERT INTO users (name, email, password, role, affiliation, orcid)
VALUES (?, ?, ?, ?, ?, ?);

-- ===== PAPERS =====
-- Submit new paper
INSERT INTO papers (title, abstract, keywords, author_id, journal_id, file_path, original_filename, status)
VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted');

-- Papers by author (author dashboard)
SELECT p.*, j.name AS journal_name, j.short_name
FROM papers p JOIN journals j ON p.journal_id = j.id
WHERE p.author_id = ? ORDER BY p.submitted_at DESC;

-- Papers assigned to reviewer
SELECT p.*, j.name AS journal_name
FROM papers p JOIN journals j ON p.journal_id = j.id
WHERE p.reviewer_id = ? ORDER BY p.submitted_at DESC;

-- Public published papers archive (with optional filters)
SELECT p.id, p.title, p.abstract, p.keywords, p.volume, p.issue, p.doi, p.published_at,
       u.name AS author_name, j.name AS journal_name, j.short_name
FROM papers p
JOIN users u ON p.author_id = u.id
JOIN journals j ON p.journal_id = j.id
WHERE p.status = 'published'
  AND (? IS NULL OR j.id = ?)
  AND (? IS NULL OR p.title LIKE CONCAT('%', ?, '%') OR p.keywords LIKE CONCAT('%', ?, '%'))
ORDER BY p.published_at DESC;

-- Update paper status / review (admin or reviewer)
UPDATE papers SET status = ?, review_comments = ?, reviewer_id = ? WHERE id = ?;

-- Publish a paper
UPDATE papers SET status = 'published', published_at = NOW(), volume = ?, issue = ?, doi = ? WHERE id = ?;

-- Live counts for homepage
SELECT COUNT(*) AS total_published FROM papers WHERE status = 'published';
SELECT COUNT(*) AS total_journals FROM journals;
SELECT COUNT(*) AS total_reviewers FROM users WHERE role = 'reviewer';

-- ===== JOURNALS =====
SELECT * FROM journals ORDER BY id;
UPDATE journals SET cfp_text = ?, cfp_deadline = ?, current_volume = ?, current_issue = ? WHERE id = ?;

-- ===== EDITORIAL BOARD =====
SELECT eb.*, j.short_name AS journal_short_name
FROM editorial_board eb LEFT JOIN journals j ON eb.journal_id = j.id
ORDER BY eb.sort_order;

-- ===== ABOUT PAGE CONTENT =====
SELECT * FROM about_items WHERE section = 'objective' ORDER BY sort_order;
SELECT * FROM about_items WHERE section = 'core_value' ORDER BY sort_order;
SELECT * FROM about_items WHERE section = 'mission' ORDER BY sort_order;
INSERT INTO about_items (section, text, sort_order) VALUES (?, ?, ?);

-- ===== INSTITUTE DOCUMENTS =====
SELECT * FROM documents ORDER BY uploaded_at DESC;
INSERT INTO documents (title, category, file_path, original_filename, uploaded_by) VALUES (?, ?, ?, ?, ?);

-- ===== FAQ =====
SELECT * FROM faqs ORDER BY category, sort_order;

-- ===== ADMIN DASHBOARD STATS =====
SELECT status, COUNT(*) AS count FROM papers GROUP BY status;
SELECT j.name, COUNT(p.id) AS paper_count FROM journals j LEFT JOIN papers p ON j.id = p.journal_id GROUP BY j.id;
