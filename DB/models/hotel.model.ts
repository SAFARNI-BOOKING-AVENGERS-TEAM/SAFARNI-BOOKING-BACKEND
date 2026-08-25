import { Schema, model, Document, Types } from "mongoose";

export interface Hotel extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  rating: number;

  location: {
    city?: string;
    address?: string;
    lat?: number;
    lng?: number;
  };

  amenities: string[];

  gallery: {
    url: string;
    publicId: string;
  }[];

  policies: {
    checkIn?: string;
    checkOut?: string;
    cancellation?: string;
  };

  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;

  status: "pending" | "approved" | "rejected";
}

const HotelSchema = new Schema<Hotel>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: String,

    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    location: {
      city: String,
      address: String,
      lat: Number,
      lng: Number,
    },

    amenities: [String],

    gallery: [
      {
        url: String,
        publicId: String,
      },
    ],

    policies: {
      checkIn: String,
      checkOut: String,
      cancellation: String,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

HotelSchema.index({ "location.city": 1 });
HotelSchema.index({ rating: -1 });
HotelSchema.index({ name: "text", description: "text" });
HotelSchema.index({ status: 1, createdBy: 1 });

const HotelModel = model<Hotel>("Hotel", HotelSchema);

export default HotelModel;