import mongoose, { Schema, Types } from "mongoose";

export interface ICar {
  brand: string;
  model: string;
  year?: number;
  type: "SUV" | "Sedan" | "Hatchback" | "Convertible" | "Luxury";
  transmission: "Automatic" | "Manual";
 
  seats: number;
  pricePerDay: number;
  available: boolean;
  location: {
    city: string;
    address?: string;
  };
  image?: string;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CarSchema = new Schema<ICar>(
  {
    brand: { type: String, required: [true, "Brand is required"], trim: true },
    model: { type: String, required: [true, "Model is required"], trim: true },
    year: { type: Number },
    type: {
      type: String,
      enum: ["SUV", "Sedan", "Hatchback", "Convertible", "Luxury"],
      required: [true, "Car type is required"],
    },
    transmission: {
      type: String,
      enum: ["Automatic", "Manual"],
      required: [true, "Transmission type is required"],
    },
    
    seats: { type: Number, required: [true, "Seats count is required"] },
    pricePerDay: { type: Number, required: [true, "Price per day is required"] },
    available: { type: Boolean, default: true },
    location: {
      city: { type: String, required: [true, "City is required"] },
      address: { type: String },
    },
    image: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const CarModel = mongoose.model<ICar>("Car", CarSchema);
export default CarModel;
