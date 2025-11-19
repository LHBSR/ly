import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TG_TOKEN = process.env.TG_BOT_TOKEN;
const TG_CHAT = process.env.TG_CHAT_ID;

if (!TG_TOKEN || !TG_CHAT) {
  console.log("❌ Missing BOT TOKEN or CHAT ID");
}

const app = express();
app.use(cors());
app.use(express.json());

// ===== Upload setup =====
const uploadFolder = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadFolder),
  filename: (_req, file, cb) => {
    const safe = Date.now() + "-" + file.originalname.replace(/[^0-9a-zA-Z.-]/g, "_");
    cb(null, safe);
  }
});

const upload = multer({ storage });

// ====== ROUTES =======

// Health check
app.get("/_health", (req, res) => res.send("ok"));

// Main upload + telegram send
app.post("/submit-order", upload.fields([
  { name: "receipt", maxCount: 1 },
  { name: "receipt2", maxCount: 1 },
  { name: "snap", maxCount: 1 }
]), async (req, res) => {

  try {
    const files = req.files;
    const body = req.body;

    // Send message to Telegram
    await axios.post(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      chat_id: TG_CHAT,
      text: `📩 طلب جديد\nالخدمة: ${body.service_title}\nالسعر: ${body.amount}`
    });

    // Send files
    for (const field of ["receipt", "receipt2", "snap"]) {
      if (files[field]) {
        const filePath = files[field][0].path;

        await axios.post(
          `https://api.telegram.org/bot${TG_TOKEN}/sendDocument`,
          {
            chat_id: TG_CHAT,
            caption: field,
          },
          {
            headers: {
              "Content-Type": "multipart/form-data"
            },
            data: {
              document: fs.createReadStream(filePath),
            }
          }
        );
      }
    }

    return res.json({ ok: true });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🔥 Server running on ${PORT}`));
