const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

// مجلد رفع الملفات
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// إعداد التخزين
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || "";
    const base = path.basename(file.originalname, ext).replace(/\s+/g, "-");
    cb(null, `${base}-${Date.now()}${ext}`);
  },
});

// إعداد multer
const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 }, // 12MB
  fileFilter: (req, file, cb) => {
    const ok = /jpeg|jpg|png|webp|gif/.test(file.mimetype);
    ok ? cb(null, true) : cb(new Error("Invalid file type"));
  },
});

// الحقول اللي يقبلها السيرفر (نفس أسماء الواجهة)
const uploadFields = upload.fields([
  { name: "receipt1", maxCount: 1 },
  { name: "receipt2", maxCount: 1 },
  { name: "snap", maxCount: 1 }
]);

// استقبال الطلب
app.post("/submit-order", (req, res) => {
  uploadFields(req, res, function (err) {
    if (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }

    return res.json({
      ok: true,
      message: "Files received successfully",
      files: req.files,
      body: req.body,
    });
  });
});

// صفحة اختبار
app.get("/", (req, res) => res.send("Server is working"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log("Server running on port " + PORT)
);
