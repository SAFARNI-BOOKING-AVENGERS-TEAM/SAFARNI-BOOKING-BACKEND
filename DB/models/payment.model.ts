import { Schema, model, Document, Types } from "mongoose";

export interface IPaymentRefund {
  bookingId: string;
  amount: number;
  stripeRefundId: string;
  createdAt: Date;
}

export interface IPayment extends Document {
  userId: Types.ObjectId;
  bookingId?: string;
  packageBookingId?: string;
  amount: number;
  currency: string;
  stripePaymentIntentId: string;
  status: "pending" | "succeeded" | "failed";
  refunds: IPaymentRefund[];
}

const paymentSchema = new Schema<IPayment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    bookingId: { type: String },
    packageBookingId: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: "usd" },
    stripePaymentIntentId: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["pending", "succeeded", "failed"],
      default: "pending",
    },
    refunds: [
      {
        bookingId: { type: String, required: true },
        amount: { type: Number, required: true },
        stripeRefundId: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

paymentSchema.index({ userId: 1 });

export default model<IPayment>("Payment", paymentSchema);