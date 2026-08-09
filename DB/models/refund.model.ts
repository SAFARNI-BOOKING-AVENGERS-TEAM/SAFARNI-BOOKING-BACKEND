import { Schema, model, Document, Types } from "mongoose";

/** Mirrors Stripe's Refund object `status` field values exactly. */
export type RefundStatus =
  | "pending"
  | "succeeded"
  | "failed"
  | "canceled";

/** Mirrors Stripe's accepted `reason` values for refund creation. */
export type RefundReason =
  | "duplicate"
  | "fraudulent"
  | "requested_by_customer";

export type RefundCurrency = "USD";

export interface IRefund extends Document {
  paymentId: Types.ObjectId;

  /** Denormalized from Payment at creation time — lets admin/provider dashboards filter refunds by booking without a lookup through Payment. */
  bookingId?: Types.ObjectId | null;
  packageBookingId?: string | null;

  /** Who triggered this refund — the customer (self-service cancellation) or an admin/provider (dispute resolution, goodwill refund). */
  initiatedBy: Types.ObjectId;

  amount: number;
  currency: RefundCurrency;

  reason: RefundReason;
  status: RefundStatus;

  stripeRefundId: string;

  /** Same deterministic-idempotency-key pattern as Payment, scoped to this refund request specifically (a second identical refund request must not double-refund). */
  idempotencyKey: string;

  failureReason?: string | null;

  createdAt: Date;
  updatedAt: Date;
}

const refundSchema = new Schema<IRefund>(
  {
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      required: [true, "Payment ID is required"],
    },

    bookingId: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },

    packageBookingId: {
      type: String,
      default: null,
    },

    initiatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Initiating user ID is required"],
    },

    amount: {
      type: Number,
      required: [true, "Refund amount is required"],
      min: [0.01, "Refund amount must be greater than 0"],
    },

    currency: {
      type: String,
      enum: ["USD"],
      default: "USD",
      required: true,
    },

    reason: {
      type: String,
      enum: ["duplicate", "fraudulent", "requested_by_customer"],
      required: [true, "Refund reason is required"],
    },

    status: {
      type: String,
      enum: ["pending", "succeeded", "failed", "canceled"],
      default: "pending",
    },

    stripeRefundId: {
      type: String,
      required: [true, "Stripe refund ID is required"],
      unique: true,
    },

    idempotencyKey: {
      type: String,
      required: [true, "Idempotency key is required"],
      unique: true,
    },

    failureReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

refundSchema.index({ paymentId: 1, createdAt: -1 });
refundSchema.index({ bookingId: 1 });

const RefundModel = model<IRefund>("Refund", refundSchema);

export default RefundModel;
