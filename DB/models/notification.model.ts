import { Schema, model, Document, Types } from "mongoose";

export interface INotification extends Document {
  userId: Types.ObjectId;
  title: string;
  message: string;
  type: "booking_created" | "booking_status_changed" | "service_approved" | "service_rejected";
  isRead: boolean;
  relatedId?: string;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: [
        "booking_created",
        "booking_status_changed",
        "service_approved",
        "service_rejected",
      ],
      required: true,
    },
    isRead: { type: Boolean, default: false },
    relatedId: { type: String },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, isRead: 1 });

export default model<INotification>("Notification", notificationSchema);