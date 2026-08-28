import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../DB/connect";
import TourModel from "../DB/models/tour.model";
import PackageModel from "../DB/models/package.model";

const replacements = new Map<string, string>([
  [
    "https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1568322445389-f64ac2515020?auto=format&fit=crop&w=1400&q=80",
  ],
  [
    "https://images.unsplash.com/photo-1603523009205-5b0bb6c5c5e2?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1572252009286-268acec5ca0a?auto=format&fit=crop&w=1400&q=80",
  ],
]);

const assertSafeDatabase = () => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to repair demo fixtures while NODE_ENV=production");
  }

  const uri = process.env.MONGO_URI || "";
  if (!uri) throw new Error("MONGO_URI is required");
  const looksLocal = /mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//i.test(uri);
  if (!looksLocal && process.env.ALLOW_REMOTE_SEED !== "true") {
    throw new Error("Refusing to modify a non-local MongoDB without ALLOW_REMOTE_SEED=true");
  }
};

const replaceUrl = (value?: string) => (value ? replacements.get(value) || value : value);

async function main() {
  assertSafeDatabase();
  await connectDB();

  let repaired = 0;

  const tours = await TourModel.find({
    $or: [
      { mainImage: { $in: [...replacements.keys()] } },
      { gallery: { $in: [...replacements.keys()] } },
    ],
  });

  for (const tour of tours) {
    const beforeMain = tour.mainImage;
    const beforeGallery = JSON.stringify(tour.gallery || []);
    tour.mainImage = replaceUrl(tour.mainImage) || tour.mainImage;
    tour.gallery = (tour.gallery || []).map((url) => replaceUrl(url) || url);
    if (beforeMain !== tour.mainImage || beforeGallery !== JSON.stringify(tour.gallery || [])) {
      await tour.save();
      repaired += 1;
    }
  }

  const packages = await PackageModel.find({
    $or: [
      { coverImage: { $in: [...replacements.keys()] } },
      { gallery: { $in: [...replacements.keys()] } },
    ],
  });

  for (const pkg of packages) {
    const beforeCover = pkg.coverImage;
    const beforeGallery = JSON.stringify(pkg.gallery || []);
    pkg.coverImage = replaceUrl(pkg.coverImage);
    pkg.gallery = (pkg.gallery || []).map((url) => replaceUrl(url) || url);
    if (beforeCover !== pkg.coverImage || beforeGallery !== JSON.stringify(pkg.gallery || [])) {
      await pkg.save();
      repaired += 1;
    }
  }

  console.log(`Demo image repair complete. Updated ${repaired} document(s).`);
}

main()
  .catch((error) => {
    console.error("Demo image repair failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
