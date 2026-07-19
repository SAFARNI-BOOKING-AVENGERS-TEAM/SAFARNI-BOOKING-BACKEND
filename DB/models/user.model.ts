import { Schema, model, Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: "user" | "service_provider" | "admin";
  service?: "flights" | "cars" | "hotels";
  isVerified: boolean;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
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
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please use a valid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      select: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ["user", "service_provider", "admin"],
      default: "user",
      required: [true, "User role is required"]
    },
    service:{
      type: String,
      enum: [ "flights", "cars", "hotels"],
      required: function() {
        return this.role === "service_provider";
      },
    },
    passwordResetToken: String,
    passwordResetExpires: Date,
    profilePicture: {
      url: String,
      publicId: String,
    },
  },
  {
    timestamps: true,
  }
);

const UserModel = model<IUser>("User", userSchema);

export default UserModel;