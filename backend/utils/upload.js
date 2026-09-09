const multer = require("multer");
const path = require("path");
const fs = require("fs");

function makeStorage(subfolder) {
  const dir = path.join(__dirname, "..", "uploads", subfolder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      const safeExt = path.extname(file.originalname).toLowerCase();
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
      cb(null, unique);
    },
  });
}

// Extension-only check, deliberately not also requiring a matching MIME
// type: browsers (mobile Chrome/Samsung Internet especially, and in-app
// browsers like WhatsApp/Facebook) are inconsistent about what `mimetype`
// they report for .docx — it's technically a zip container, so it's common
// to see `application/octet-stream`, `application/zip`, or nothing at all
// instead of the real OOXML type. Requiring both silently rejected real
// paper submissions from mobile visitors (the majority of this form's
// traffic) before they ever reached the database or the editor's inbox.
const paperFilter = (req, file, cb) => {
  const isDocxExt = file.originalname.toLowerCase().endsWith(".docx");
  if (isDocxExt) cb(null, true);
  else cb(new Error("Only Word (.docx) files are allowed for paper submissions"));
};

const imageFilter = (req, file, cb) => {
  const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Only PNG, JPG, WEBP or SVG images are allowed"));
};

const uploadPaper = multer({
  storage: makeStorage("papers"),
  fileFilter: paperFilter,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

// Same "papers" folder as uploadPaper above, but also allows a PDF — used
// only for the admin-only "manually add a paper" upload (an admin attaching
// a paper's file directly, e.g. one that arrived by email or in print,
// rather than through the public docx-only submission form). The public
// submission form and the logged-in author submission route both keep using
// the stricter uploadPaper/paperFilter above unchanged — this one is
// intentionally separate so widening it can never accidentally widen those.
const paperOrPdfFilter = (req, file, cb) => {
  const name = file.originalname.toLowerCase();
  if (name.endsWith(".docx") || name.endsWith(".pdf")) cb(null, true);
  else cb(new Error("Only Word (.docx) or PDF (.pdf) files are allowed"));
};

const uploadPaperOrPdf = multer({
  storage: makeStorage("papers"),
  fileFilter: paperOrPdfFilter,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

const uploadImage = multer({
  storage: makeStorage("board"),
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const uploadLogo = multer({
  storage: makeStorage("logos"),
  fileFilter: imageFilter,
  limits: { fileSize: 3 * 1024 * 1024 },
});

const uploadNotice = multer({
  storage: makeStorage("notices"),
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Institute documents are Word (.docx) only now — same rule as paper
// submissions, and no PDFs anywhere in the system (receipts included; see
// utils/receiptGenerator.js).
const documentFilter = (req, file, cb) => {
  const isDocxExt = file.originalname.toLowerCase().endsWith(".docx");
  if (isDocxExt) cb(null, true);
  else cb(new Error("Only Word (.docx) files are allowed"));
};

const uploadDocument = multer({
  storage: makeStorage("documents"),
  fileFilter: documentFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

module.exports = { uploadPaper, uploadPaperOrPdf, uploadImage, uploadLogo, uploadNotice, uploadDocument };
