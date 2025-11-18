// server.js
// Express server for Render (Node 18). Matches your index.html fields and endpoint /submit-order

import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${ts}-${safe}`);
  }
});

const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } });

app.post('/submit-order', upload.fields([
  { name: 'receipt', maxCount: 1 },
  { name: 'receipt2', maxCount: 1 },
  { name: 'snap', maxCount: 1 }
]), (req, res) => {
  try {
    const files = req.files || {};
    if (!files.receipt || !files.snap) {
      Object.values(files).flat().forEach(f => {
        try { fs.unlinkSync(f.path); } catch(e){}
      });
      return res.status(400).json({ ok: false, error: 'receipt_and_snap_required' });
    }

    const saved = [];
    for (const key of ['receipt','receipt2','snap']){
      if (files[key] && files[key].length) {
        const f = files[key][0];
        saved.push({ field: key, originalName: f.originalname, savedAs: path.basename(f.path), size: f.size });
      }
    }

    const { service_title, amount } = req.body;
    console.log('New order:', { service_title, amount, files: saved });

    return res.json({ ok: true, files: saved, service_title: service_title || null, amount: amount || null });
  } catch (err) {
    console.error('submit-order error', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

app.get('/_health', (_req, res) => res.send('ok'));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
