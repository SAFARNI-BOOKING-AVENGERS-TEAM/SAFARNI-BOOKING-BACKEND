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
}
const HotelSchema = new Schema<Hotel>(
  {
    name: {
      type: String,
      required: true
    },

    description: String,
    rating: {
      type: Number,
      default: 0
    },

    location: {
      city: String,
      address: String,
      lat: Number,
      lng: Number
    },

    amenities: [String],

    gallery: [
      {
        url: String,
        publicId: String
      }
    ],

    policies: {
      checkIn: String,
      checkOut: String,
      cancellation: String
    }
  },
  { timestamps: true }
);

const HotelModel = model<Hotel>("Hotel", HotelSchema);

export default HotelModel;
