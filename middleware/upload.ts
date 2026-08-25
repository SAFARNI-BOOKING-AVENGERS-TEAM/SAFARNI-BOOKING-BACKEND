import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../utils/cloudinary/cloudinary";
import fs from "fs";
import path from "path";

const allowedMimeTypes = new Set(["image/jpeg", "image/png"]);
const maxFileSize = 5 * 1024 * 1024;

let storage: any;

if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: "hotels",
      allowed_formats: ["jpg", "jpeg", "png"],
    } as any,
  });
} else {
  if (!fs.existsSync("./uploads")) fs.mkdirSync("./uploads");
  storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, "./uploads"),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    },
  });
}

export const upload = multer({
  storage,
  limits: {
    fileSize: maxFileSize,
    files: 5,
    fields: 20,
    parts: 30,
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
    }
    cb(null, true);
  },
});
