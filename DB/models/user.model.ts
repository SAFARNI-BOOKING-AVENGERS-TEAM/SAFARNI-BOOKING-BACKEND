import { Schema, model, Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  isVerified: boolean;
  role: "user" | "provider" | "admin";
  providerType?: "travel" | "telecom" | "both";
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  refreshTokenVersion: number;
  profilePicture?: { url: string; publicId: string };
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: [true, "Name is required"], trim: true },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please use a valid email address"],
    },
    password: { type: String, required: [true, "Password is required"], select: false },
    isVerified: { type: Boolean, default: false },
    role: { type: String, enum: ["user", "provider", "admin"], default: "user" },
    providerType: { type: String, enum: ["travel", "telecom", "both"] },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    refreshTokenVersion: { type: Number, default: 0 },
    profilePicture: { url: String, publicId: String },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: any) => {
        delete ret.password;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.emailVerificationToken;
        delete ret.emailVerificationExpires;
        delete ret.refreshTokenVersion;
        return ret;
      },
    },
  }
);

const UserModel = model<IUser>("User", userSchema);
export default UserModel;
