import { Schema, model, Document, Types } from "mongoose";

export interface IPackageItem {
  category: "tours" | "hotels" | "cars" | "flights";
  itemId: string;
  order: number;
}

export interface IPackage extends Document {
  title: string;
  description?: string;
  coverImage?: string;
  gallery?: string[];
  country?: string;
  cities?: string[];
  tags?: string[];
  packageType?: "family" | "couples" | "luxury" | "budget" | "adventure" | "business";
  durationLabel?: string;
  items: IPackageItem[];
  discountPercentage: number;
  estimatedOriginalPrice: number;
  featured: boolean;
  validUntil?: Date;
  sourceType: "provider" | "curated";
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  status: "pending" | "approved" | "rejected";
}

const packageSchema = new Schema<IPackage>(
  {
    title: { type: String, required: true },
    description: { type: String },
    coverImage: { type: String },
    gallery: [{ type: String }],
    country: { type: String },
    cities: [{ type: String }],
    tags: [{ type: String }],
    packageType: {
      type: String,
      enum: ["family", "couples", "luxury", "budget", "adventure", "business"],
    },
    durationLabel: { type: String },
    items: [
      {
        category: {
          type: String,
          enum: ["tours", "hotels", "cars", "flights"],
          required: true,
        },
        itemId: { type: String, required: true },
        order: { type: Number, default: 0 },
      },
    ],
    discountPercentage: { type: Number, required: true, min: 1, max: 90 },
    estimatedOriginalPrice: { type: Number, required: true },
    featured: { type: Boolean, default: false },
    validUntil: { type: Date },
    sourceType: {
      type: String,
      enum: ["provider", "curated"],
      required: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

packageSchema.index({ status: 1 });
packageSchema.index({ packageType: 1 });
packageSchema.index({ featured: 1 });
packageSchema.index({ sourceType: 1 });
packageSchema.index({ title: "text", description: "text", tags: "text" });

export default model<IPackage>("Package", packageSchema);