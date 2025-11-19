// server.js — يعمل مع Render، يستقبل 3 ملفات ويرسلهم للتليجرام

import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import axios from "axios";
import FormData from "form-data";
import dotenv from "dotenv";

dotenv.config();

// Paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Express setup
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from root (index.html موجود في root)
app.use(express.static(__dirname));

// Upload folder
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    cb(null, `${ts}-${safe}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }
});

const uploadFields = upload.fields([
  { name: "receipt", maxCount: 1 },
  { name: "receipt2", maxCount: 1 },
  { name: "snap", maxCount: 1 }
]);

// Telegram config (لازم تضيف القيم في Render)
const TG_TOKEN = process.env.TG_BOT_TOKEN;
const TG_CHAT_ID = process.env.TG_CHAT_ID;

// send file to Telegram
async function sendToTelegram(filePath, caption = "") {
  const url = `https://api.telegram.org/bot${TG_TOKEN}/sendDocument`;

  const fd = new FormData();
  fd.append("chat_id", TG_CHAT_ID);
  fd.append("caption", caption);
  fd.append("document", fs.createReadStream(filePath));

  const headers = fd.getHeaders();

  const res = await axios.post(url, fd, { headers });
  return res.data;
}

// /submit-order
app.post("/submit-order", (req, res) => {
  uploadFields(req, res, async function (err) {
    if (err) {
      console.error("Upload error:", err);
      return res.status(400).json({ ok: false, error: err.message });
    }

    try {
      const files = req.files || {};

      if (!files.receipt || !files.snap) {
        return res.status(400).json({ ok: false, error: "receipt_and_snap_required" });
      }

      const saved = [];
      for (const key of ["receipt", "receipt2", "snap"]) {
        if (files[key] && files[key].length) {
          const f = files[key][0];
          saved.push({
            field: key,
            name: f.filename,
            size: f.size,
            path: f.path
          });
        }
      }

      const { service_title, amount } = req.body;

      // send files to Telegram
      for (const file of saved) {
        try {
          await sendToTelegram(
            file.path,
            `طلب جديد\nالخدمة: ${service_title}\nالمبلغ: ${amount}`
          );
        } catch (e) {
          console.error("Telegram error:", e.message);
        }
      }

      return res.json({
        ok: true,
        message: "Order received",
        files: saved
      });

    } catch (e) {
      console.error("Server error:", e);
      return res.status(500).json({ ok: false, error: "server_error" });
    }
  });
});

// health
app.get("/_health", (_req, res) => res.send("ok"));

// index.html
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
