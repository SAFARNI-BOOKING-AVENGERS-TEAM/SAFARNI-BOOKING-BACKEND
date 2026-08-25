import multer from "multer";
import cloudinary from "../utils/cloudinary/cloudinary";
import fs from "fs";
import path from "path";
import type { Request } from "express";

const allowedMimeTypes = new Set(["image/jpeg", "image/png"]);
const maxFileSize = 5 * 1024 * 1024;

const hasCloudinaryConfig = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
);

class CloudinaryMulterStorage implements multer.StorageEngine {
  _handleFile(
    _req: Request,
    file: Express.Multer.File,
    cb: (error?: any, info?: Partial<Express.Multer.File>) => void
  ) {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "safarni",
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png"],
      },
      (error, result) => {
        if (error || !result) {
          return cb(error || new Error("Cloudinary upload failed"));
        }

        cb(null, {
          path: result.secure_url,
          filename: result.public_id,
          size: result.bytes,
        });
      }
    );

    file.stream.on("error", cb);
    file.stream.pipe(uploadStream);
  }

  _removeFile(
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null) => void
  ) {
    const publicId = file.filename;

    if (!publicId) {
      cb(null);
      return;
    }

    cloudinary.uploader
      .destroy(publicId)
      .then(() => cb(null))
      .catch((error) => cb(error instanceof Error ? error : new Error(String(error))));
  }
}

let storage: multer.StorageEngine;

if (hasCloudinaryConfig) {
  storage = new CloudinaryMulterStorage();
} else {
  if (!fs.existsSync("./uploads")) {
    fs.mkdirSync("./uploads", { recursive: true });
  }

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
