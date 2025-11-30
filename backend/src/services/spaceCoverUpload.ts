import path from "path";
import fs from "fs";
import multer from "multer";

const uploadRoot = path.resolve("uploads");
const spaceCoversDir = path.join(uploadRoot, "space-covers");

// garante que a pasta existe
fs.mkdirSync(spaceCoversDir, { recursive: true });

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, spaceCoversDir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname) || ".jpg";
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});

export const spaceCoverUpload = multer({
  storage,
  fileFilter(_req, file, cb) {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("INVALID_FILE_TYPE"));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
});
