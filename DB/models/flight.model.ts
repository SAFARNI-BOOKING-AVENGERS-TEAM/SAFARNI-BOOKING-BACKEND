import mongoose, { Schema, Types } from "mongoose";

export interface IFlight {
  airline: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: Date;
  arrivalTime: Date;
  price: number;
  availableSeats: number;
  class: "Economy" | "Business" | "First";
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FlightSchema = new Schema<IFlight>(
  {
    airline: { type: String, required: [true, "Airline is required"], trim: true },
    flightNumber: { type: String, required: [true, "Flight number is required"], trim: true },
    departureAirport: { type: String, required: [true, "Departure airport is required"], uppercase: true, trim: true },
    arrivalAirport: { type: String, required: [true, "Arrival airport is required"], uppercase: true, trim: true },
    departureTime: { type: Date, required: [true, "Departure time is required"] },
    arrivalTime: { type: Date, required: [true, "Arrival time is required"] },
    price: { type: Number, required: [true, "Ticket price is required"] },
    availableSeats: { type: Number, required: [true, "Available seats count is required"] },
    class: {
      type: String,
      enum: ["Economy", "Business", "First"],
      default: "Economy",
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const FlightModel = mongoose.model<IFlight>("Flight", FlightSchema);
export default FlightModel;
