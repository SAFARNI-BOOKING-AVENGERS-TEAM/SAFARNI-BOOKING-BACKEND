import { Schema, model, Document, Types } from "mongoose";

export interface IESIMOrder extends Document {
  userId: Types.ObjectId;
  planId: Types.ObjectId;
  planSnapshot?: {
    name: string;
    country: string;
    region?: string;
    dataAmount: number;
    dataUnit: "MB" | "GB" | "Unlimited";
    validityDays: number;
  };
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  price: number;
  currency: string;
  packageBookingId?: string;
  profile?: {
    iccid: string;
    activationCode: string;
    qrCode: string;
    smdpAddress: string;
    status: "ready" | "activated" | "expired" | "suspended";
    expiresAt?: Date;
  };
}

const esimOrderSchema = new Schema<IESIMOrder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    planId: { type: Schema.Types.ObjectId, ref: "ESIMPlan", required: true },
    planSnapshot: {
      name: { type: String },
      country: { type: String },
      region: { type: String },
      dataAmount: { type: Number },
      dataUnit: { type: String, enum: ["MB", "GB", "Unlimited"] },
      validityDays: { type: Number },
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed", "cancelled"],
      default: "pending",
    },
    price: { type: Number, required: true },
    currency: { type: String, required: true },
    packageBookingId: { type: String },
    profile: {
      iccid: { type: String },
      activationCode: { type: String },
      qrCode: { type: String },
      smdpAddress: { type: String },
      status: {
        type: String,
        enum: ["ready", "activated", "expired", "suspended"],
      },
      expiresAt: { type: Date },
    },
  },
  { timestamps: true }
);

esimOrderSchema.index({ userId: 1 });
esimOrderSchema.index({ status: 1 });
esimOrderSchema.index({ planId: 1 });

export default model<IESIMOrder>("ESIMOrder", esimOrderSchema);
