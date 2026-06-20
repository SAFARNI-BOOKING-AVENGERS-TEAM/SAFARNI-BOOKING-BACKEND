import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../utils/cloudinary/cloudinary";

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "hotels",
    allowed_formats: ["jpg", "jpeg", "png"]
  } as any 
});

export const upload = multer({ storage });
