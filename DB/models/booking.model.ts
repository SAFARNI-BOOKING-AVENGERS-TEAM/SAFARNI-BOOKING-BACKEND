import { Schema, model, Document, Types } from "mongoose";

export interface IBooking extends Document {
  userId: Types.ObjectId;
  category: "tours" | "flights" | "cars" | "hotels";
  itemId: string;
  startDate: Date;
  endDate: Date;
  totalPrice: number;
  status: "pending" | "confirmed" | "cancelled";
  details?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}   

const bookingSchema = new Schema<IBooking>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    category: {
      type: String,
      enum: ["tours", "flights", "cars", "hotels"],
      required: [true, "Booking category is required"],
    },
    itemId: {
      type: String,
      required: [true, "Item ID is required"],
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },
    totalPrice: {
      type: Number,
      required: [true, "Total price is required"],
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled"],
      default: "pending",
    },
    details: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

const BookingModel = model<IBooking>("Booking", bookingSchema);

export default BookingModel;
