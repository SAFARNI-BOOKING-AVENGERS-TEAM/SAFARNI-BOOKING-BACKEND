import { Schema, model, Document, Types } from "mongoose";

/**
 * Payment lifecycle status, independent from the fulfilment `status` field.
 * A booking can be `status: "pending"` (not yet confirmed by the provider)
 * while `paymentStatus: "paid"` (money already captured) — these two state
 * machines are related but NOT the same thing and must not be conflated.
 */
export type BookingPaymentStatus =
  | "unpaid" // default — no checkout session created yet
  | "pending" // checkout session created, awaiting Stripe webhook confirmation
  | "paid"
  | "failed"
  | "refunded"
  | "partially_refunded";

/**
 * Fixed to USD for now, matching the platform's current single-currency
 * reality (no other module prices in a different currency). Kept as an
 * explicit field — rather than a hardcoded constant in the payment module —
 * so multi-currency support can be added later without a schema migration.
 */
export type BookingCurrency = "USD";

export interface IBooking extends Document {
  userId: Types.ObjectId;
  category: "tours" | "flights" | "cars" | "hotels";
  itemId: string;
  packageBookingId?: string;
  startDate: Date;
  endDate: Date;
  totalPrice: number;
  currency: BookingCurrency;
  status: "pending" | "confirmed" | "cancelled";

  /** Set once a Payment document is created for this booking (or for its package group). */
  paymentId?: Types.ObjectId | null;
  paymentStatus: BookingPaymentStatus;

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
    packageBookingId: { 
      type: String
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
    currency: {
      type: String,
      enum: ["USD"],
      default: "USD",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled"],
      default: "pending",
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: [
        "unpaid",
        "pending",
        "paid",
        "failed",
        "refunded",
        "partially_refunded",
      ],
      default: "unpaid",
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

bookingSchema.index({ userId: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ category: 1 });
bookingSchema.index({ packageBookingId: 1 });
bookingSchema.index({ paymentStatus: 1 });

export default BookingModel;
