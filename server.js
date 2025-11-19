// server.js
// Express server (ES modules). Accepts files from index.html and optionally forwards to Telegram.
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import axios from "axios";
import FormData from "form-data";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// serve static (your front-end files)
app.use(express.static(path.join(__dirname, "public")));

// upload dir
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// multer storage + safe filename
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    cb(null, `${ts}-${safe}`);
  }
});

const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB

// fields expected from your front-end
const uploadFields = upload.fields([
  { name: "receipt", maxCount: 1 },
  { name: "receipt2", maxCount: 1 },
  { name: "snap", maxCount: 1 }
]);

// Telegram config (optional)
const TG_TOKEN = process.env.TG_BOT_TOKEN || "";
const TG_CHAT_ID = process.env.TG_CHAT_ID || "";

/**
 * Send a single file to Telegram as document using axios+form-data.
 * Returns Telegram response object or throws.
 */
async function sendFileToTelegram(filePath, caption = "") {
  if (!TG_TOKEN || !TG_CHAT_ID) {
    return { ok: false, description: "Telegram token/chat not configured" };
  }
  const url = https://api.telegram.org/bot${TG_TOKEN}/sendDocument;
  const form = new FormData();
  form.append("chat_id", TG_CHAT_ID);
  if (caption) form.append("caption", caption);
  form.append("document", fs.createReadStream(filePath));

  const headers = form.getHeaders();
  const res = await axios.post(url, form, { headers, timeout: 30000 });
  return res.data;
}

app.post("/submit-order", (req, res) => {
  uploadFields(req, res, async function (err) {
    if (err) {
      console.error("Upload error:", err && err.message ? err.message : err);
      return res.status(400).json({ ok: false, error: err.message || "upload_error" });
    }

    try {
      const files = req.files || {};
      // require at least receipt and snap
      if (!files.receipt  !files.receipt.length  !files.snap || !files.snap.length) {
        // remove any uploaded files in this request to avoid leftover files
        Object.values(files).flat().forEach((f) => {
          try { fs.unlinkSync(f.path); } catch (e) { /* ignore */ }
        });
        return res.status(400).json({ ok: false, error: "receipt_and_snap_required" });
      }

      // build saved files summary
      const saved = [];
      for (const key of ["receipt", "receipt2", "snap"]) {
        if (files[key] && files[key].length) {
          const f = files[key][0];
          saved.push({
            field: key,
            originalName: f.originalname,
            savedAs: path.basename(f.path),
            size: f.size,
            path: f.path
          });
        }
      }

      const { service_title, amount } = req.body;
      console.log("New order received:", { service_title, amount, files: saved.map(s => ({ field: s.field, savedAs: s.savedAs })) });

      // optionally send to Telegram (if configured)
      const telegramResults = [];
      if (TG_TOKEN && TG_CHAT_ID) {
        const caption = طلب جديد\nخدمة: ${service_title || "غير محدد"}\nالمبلغ: ${amount || "غير محدد"};
        for (const fileObj of saved) {
          try {
            console.log("Sending to Telegram:", fileObj.path);
            const tgRes = await sendFileToTelegram(fileObj.path, caption);
            telegramResults.push({ file: fileObj.savedAs, telegram: tgRes });ole.log(`Server listening on ${PORT}`));
