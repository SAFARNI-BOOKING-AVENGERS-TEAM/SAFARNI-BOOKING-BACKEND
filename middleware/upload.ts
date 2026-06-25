import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../utils/cloudinary/cloudinary";
import fs from "fs";

let storage;

if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: "hotels",
      allowed_formats: ["jpg", "jpeg", "png"]
    } as any 
  });
} else {
  // Fallback to local disk storage in development if Cloudinary credentials are missing
  if (!fs.existsSync("./uploads")) {
    fs.mkdirSync("./uploads");
  }
  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, "./uploads");
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, file.fieldname + "-" + uniqueSuffix + "-" + file.originalname);
    }
  });
}

export const upload = multer({ storage });
