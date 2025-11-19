import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import axios from "axios";

// --- Vars ---
const TG_CHAT_ID = "7965779016";
const TG_TOKEN = "7962189544:AAGnHP_sVWB4AhnOr8-0vX9OVmgMPGT_bvQ";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve index.html directly from root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Upload folder
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

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
  limits: { fileSize: 12 * 1024 * 1024 }
});

// === ROUTE ===
app.post(
  "/submit-order",
  upload.fields([
    { name: "receipt", maxCount: 1 },
    { name: "receipt2", maxCount: 1 },
    { name: "snap", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const files = req.files || {};

      if (!files.receipt || !files.snap) {
        return res.status(400).json({ ok: false, error: "missing_files" });
      }

      const saved = [];

      for (const key of ["receipt", "receipt2", "snap"]) {
        if (files[key]) {
          const f = files[key][0];
          saved.push({
            field: key,
            path: f.path,
            name: f.originalname
          });
        }
      }

      const text =
        `طلب جديد:\n\n` +
        `الخدمة: ${req.body.service_title || "غير محدد"}\n` +
        `السعر: ${req.body.amount || "غير محدد"}\n`;

      // Send text
      await axios.post(
        `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`,
        {
          chat_id: TG_CHAT_ID,
          text
        }
      );

      // Send photos
      for (const f of saved) {
        const form = new FormData();
        form.append("chat_id", TG_CHAT_ID);
        form.append("photo", fs.createReadStream(f.path));

        await axios.post(
          `https://api.telegram.org/bot${TG_TOKEN}/sendPhoto`,
          form,
          { headers: form.getHeaders() }
        );
      }

      return res.json({ ok: true, message: "sent" });
    } catch (err) {
      console.error("SERVER ERROR:", err);
      return res.status(500).json({ ok: false, error: "server_error" });
    }
  }
);

// Fallback for any route
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server Running on ${PORT}`));
