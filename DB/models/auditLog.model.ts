import { Schema, model, Document } from "mongoose";

export interface IAuditLog extends Document {
  userId?: string;
  userEmail: string;
  method: string;
  path: string;
  statusCode: number;
  success: boolean;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    userEmail: { type: String, default: "anonymous" },
    method: { type: String, required: true },
    path: { type: String, required: true },
    statusCode: { type: Number, required: true },
    success: { type: Boolean, required: true },
  },
  { timestamps: true }
);

export default model<IAuditLog>("AuditLog", auditLogSchema);