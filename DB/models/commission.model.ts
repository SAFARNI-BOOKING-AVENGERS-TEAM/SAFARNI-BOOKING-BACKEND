import { Schema, model, Document, Types } from "mongoose";

export type CommissionStatus = "pending" | "earned" | "reversal_pending" | "reversed";

export interface ICommissionRecord extends Document {
  bookingId: string;
  packageBookingId?: string;
  paymentId: string;
  providerId: Types.ObjectId;
  category: "tours" | "flights" | "cars" | "hotels";
  grossAmount: number;
  commissionRatePercent: number;
  commissionAmount: number;
  providerNetAmount: number;
  currency: string;
  bookingEndDate: Date;
  status: CommissionStatus;
  recognizedAt?: Date;
  reversedAt?: Date;
  stripeRefundId?: string;
  refundAmount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const commissionSchema = new Schema<ICommissionRecord>(
  {
    bookingId: { type: String, required: true, unique: true },
    packageBookingId: { type: String },
    paymentId: { type: String, required: true },
    providerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    category: {
      type: String,
      enum: ["tours", "flights", "cars", "hotels"],
      required: true,
    },
    grossAmount: { type: Number, required: true },
    commissionRatePercent: { type: Number, required: true },
    commissionAmount: { type: Number, required: true },
    providerNetAmount: { type: Number, required: true },
    currency: { type: String, required: true, default: "usd" },
    bookingEndDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending", "earned", "reversal_pending", "reversed"],
      default: "pending",
    },
    recognizedAt: { type: Date },
    reversedAt: { type: Date },
    stripeRefundId: { type: String },
    refundAmount: { type: Number },
  },
  { timestamps: true }
);

commissionSchema.index({ providerId: 1, status: 1 });
commissionSchema.index({ status: 1, bookingEndDate: 1 });
commissionSchema.index({ paymentId: 1 });
commissionSchema.index({ packageBookingId: 1 });

export default model<ICommissionRecord>("CommissionRecord", commissionSchema);
