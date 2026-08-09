import { Schema, model, Document, Types } from "mongoose";

/**
 * Payment lifecycle. Mirrors IBooking's paymentStatus but is the
 * authoritative copy — Booking.paymentStatus is a denormalized projection
 * kept in sync by payment.service.ts, never written to directly from the
 * webhook handler.
 */
export type PaymentStatus =
  | "pending" // Checkout Session created, awaiting Stripe webhook
  | "processing" // Intent confirmed by Stripe, capture in flight (rare, async payment methods)
  | "paid"
  | "failed"
  | "refunded"
  | "partially_refunded";

export type PaymentCurrency = "USD";

export interface IPayment extends Document {
  userId: Types.ObjectId;

  /**
   * Exactly ONE of bookingId / packageBookingId is set — never both, never
   * neither. Enforced in payment.service.ts at creation time (not a
   * Mongoose hook, to match this codebase's existing convention of
   * validating in the service layer).
   */
  bookingId?: Types.ObjectId | null;
  packageBookingId?: string | null;

  /** Snapshot of Booking.totalPrice (or the sum across a package's bookings) at checkout-session creation time. */
  amount: number;
  currency: PaymentCurrency;

  paymentStatus: PaymentStatus;

  /** Deterministic key derived from (userId + bookingId/packageBookingId), sent to Stripe as the Idempotency-Key header. Guards against duplicate checkout sessions from double-clicks or client retries. */
  idempotencyKey: string;

  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeCustomerId?: string | null;

  /** Running total already refunded via the Refund collection. Kept denormalized here for fast reads (history list, booking detail) without a join. */
  refundedAmount: number;

  /** Stripe Checkout Sessions expire ~24h after creation by default; used to detect/clean up abandoned sessions. */
  checkoutExpiresAt?: Date | null;

  failureReason?: string | null;

  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
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

    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0.5, "Amount must be at least 0.50"], // Stripe's practical minimum for most currencies
    },

    currency: {
      type: String,
      enum: ["USD"],
      default: "USD",
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: [
        "pending",
        "processing",
        "paid",
        "failed",
        "refunded",
        "partially_refunded",
      ],
      default: "pending",
    },

    idempotencyKey: {
      type: String,
      required: [true, "Idempotency key is required"],
      unique: true,
    },

    stripeCheckoutSessionId: {
      type: String,
      default: null,
    },

    stripePaymentIntentId: {
      type: String,
      default: null,
    },

    stripeCustomerId: {
      type: String,
      default: null,
    },

    refundedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    checkoutExpiresAt: {
      type: Date,
      default: null,
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

// ---- Indexes ----

paymentSchema.index({ userId: 1, createdAt: -1 }); // GET /payments/history

paymentSchema.index(
  { stripeCheckoutSessionId: 1 },
  { unique: true, sparse: true }
);
paymentSchema.index(
  { stripePaymentIntentId: 1 },
  { unique: true, sparse: true }
);

// Prevent double payment on a single booking: only one non-terminal or
// paid Payment may exist per bookingId at a time. Enforced by MongoDB
// itself, not just application logic, so it holds even under concurrent
// requests (double-click, replay, two tabs).
paymentSchema.index(
  { bookingId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      bookingId: { $type: "objectId" },
      paymentStatus: { $in: ["pending", "processing", "paid"] },
    },
  }
);

// Same guarantee for package-group payments.
paymentSchema.index(
  { packageBookingId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      packageBookingId: { $type: "string" },
      paymentStatus: { $in: ["pending", "processing", "paid"] },
    },
  }
);

const PaymentModel = model<IPayment>("Payment", paymentSchema);

export default PaymentModel;
