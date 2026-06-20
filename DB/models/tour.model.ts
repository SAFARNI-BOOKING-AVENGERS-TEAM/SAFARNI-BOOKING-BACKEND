import mongoose, { Schema, Document, Types } from "mongoose";

export interface ITour extends Document {
  title: string;
  slug: string;
  summary: string;
  fullDescription?: string;
  mainImage: string;
  gallery?: string[];
  startDates?: {
    date: Date;
    capacity: number;
  }[];
  duration: string;
  highlights?: string[];
  activities?: string[];
  locations: {
    name: string;
    country: string;
    city?: string;
  }[];
  priceTiers: {
    type: string;
    price: number;
  }[];
  inclusiveItems?: string[];
  exclusiveItems?: string[];
  cancellationPolicy?: string;
  languages: string[];
  difficulty: string;
  providerInfo: {
    name: string;
    contact?: string;
  };
  reviews: {
    userId: Types.ObjectId;
    rating: number;
    comment?: string;
  }[];
  tags?: string[];
  recommended: boolean;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
}

const TourSchema = new Schema<ITour>(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    summary: { type: String, required: true },
    fullDescription: { type: String },
    mainImage: { type: String, required: true },
    gallery: [{ type: String }],
    startDates: [
      {
        date: { type: Date, required: true },
        capacity: { type: Number, required: true },
      },
    ],
    duration: { type: String, required: true },
    highlights: [{ type: String }],
    activities: [{ type: String }],
    locations: [
      {
        name: { type: String, required: true },
        country: { type: String, required: true },
        city: { type: String },
      },
    ],
    priceTiers: [
      {
        type: { type: String, required: true },
        price: { type: Number, required: true },
      },
    ],
    inclusiveItems: [{ type: String }],
    exclusiveItems: [{ type: String }],
    cancellationPolicy: { type: String },
    languages: [{ type: String }],
    difficulty: { type: String },
    providerInfo: {
      name: { type: String, required: true },
      contact: { type: String },
    },
    reviews: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        rating: { type: Number, required: true },
        comment: { type: String },
      },
    ],
    tags: [{ type: String }],
    recommended: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const Tour = mongoose.model<ITour>("Tour", TourSchema);
export default Tour;