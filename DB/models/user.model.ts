import { Schema, model, Document } from "mongoose";
import bcrypt from "bcrypt";
import { Request, Response, NextFunction } from "express";
export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  isVerified: boolean;
  role: "user" | "provider" | "admin";
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  refreshTokenVersion: number;
  profilePicture?: {
    url: string;
    publicId: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters long"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
    
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please use a valid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      select: false,
     minlength: [8, "Password must be at least 8 characters long"],
     maxlength: [128, "Password cannot exceed 128 characters"],
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ["user", "provider", "admin"],
      default: "user",
    },
    passwordResetToken:{ type: String , select: false },
    passwordResetExpires: { type: Date, select: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    refreshTokenVersion: {
      type: Number,
      default: 0,
    },
    profilePicture: {
      url: String,
      publicId: String,
    },
  },
  {
    timestamps: true,
  }
);
userSchema.index({ email: 1 }, { unique: true });

userSchema.index({ passwordResetToken: 1, passwordResetExpires: 1 });
userSchema.pre("save", async function (){
  if (!this.isModified("password")) return;
     
    const hashedPassword = await bcrypt.hash(this.password!, 12);
    this.password = hashedPassword;
  
 
});
const UserModel = model<IUser>("User", userSchema);

export default UserModel;