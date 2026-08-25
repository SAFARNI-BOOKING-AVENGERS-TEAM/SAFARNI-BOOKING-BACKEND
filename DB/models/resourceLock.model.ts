import { Schema, model, Document } from "mongoose";

export interface IResourceLock extends Document {
  key: string;
  expiresAt: Date;
}

const resourceLockSchema = new Schema<IResourceLock>({
  key: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
});

// TTL index: MongoDB automatically deletes the lock document once expiresAt
// passes, so a crashed request can never hold a lock forever.
resourceLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default model<IResourceLock>("ResourceLock", resourceLockSchema);