import { Schema, model, Document, Types } from "mongoose";

export interface IESIMPlan extends Document {
  name: string;
  country: string;
  region?: string;
  dataAmount: number;
  dataUnit: "MB" | "GB" | "Unlimited";
  validityDays: number;
  price: number;
  currency: string;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  status: "pending" | "approved" | "rejected";
}

const esimPlanSchema = new Schema<IESIMPlan>(
  {
    name: { type: String, required: true },
    country: { type: String, required: true },
    region: { type: String },
    dataAmount: { type: Number, required: true },
    dataUnit: { type: String, enum: ["MB", "GB", "Unlimited"], default: "GB" },
    validityDays: { type: Number, required: true },
    price: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

esimPlanSchema.index({ country: 1 });
esimPlanSchema.index({ region: 1 });
esimPlanSchema.index({ status: 1 });

export default model<IESIMPlan>("ESIMPlan", esimPlanSchema);