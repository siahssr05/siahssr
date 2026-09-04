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

const paperFilter = (req, file, cb) => {
  const isDocxMime =
    file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const isDocxExt = file.originalname.toLowerCase().endsWith(".docx");

  if (isDocxMime && isDocxExt) cb(null, true);
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
  const isDocxMime =
    file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const isDocxExt = file.originalname.toLowerCase().endsWith(".docx");

  if (isDocxMime && isDocxExt) cb(null, true);
  else cb(new Error("Only Word (.docx) files are allowed"));
};

const uploadDocument = multer({
  storage: makeStorage("documents"),
  fileFilter: documentFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

module.exports = { uploadPaper, uploadImage, uploadLogo, uploadNotice, uploadDocument };
