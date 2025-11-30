// backend/src/services/routes/uploads.ts
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Diretório base dos uploads: ./uploads
const uploadsRoot = path.resolve('uploads');
const spaceCoversDir = path.join(uploadsRoot, 'space-covers');

// Garante que a pasta exista
fs.mkdirSync(spaceCoversDir, { recursive: true });

// Configuração do multer
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, spaceCoversDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    const safeBase = base.replace(/[^a-zA-Z0-9-_]/g, '_');
    const timestamp = Date.now();
    cb(null, `${safeBase}-${timestamp}${ext}`);
  },
});

const upload = multer({ storage });

/**
 * POST /space-cover
 * Body: multipart/form-data, campo "file"
 * Resposta: { url: "/uploads/space-covers/arquivo.ext" }
 */
router.post('/space-cover', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'no_file' });
  }

  const relativeUrl = `/uploads/space-covers/${req.file.filename}`;

  return res.status(201).json({
    url: relativeUrl,
  });
});

export default router;
