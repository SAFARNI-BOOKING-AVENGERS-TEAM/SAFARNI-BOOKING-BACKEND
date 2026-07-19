import { setTokenCookie, clearTokenCookie } from "./../../utils/cookies/cookies";
import { generateTokens } from "./../../utils/security/token.security";
import { Request, Response } from "express";
import { ForgetPasswordRequest, LoginRequest } from "./types/request.types";
import UserModel from "../../DB/models/user.model";
import { createRandomToken } from "../../utils/security/jwtToken.security";
import { sendEmail } from "../../utils/response/email/sendEmail.email";
import { getResetPasswordTemplate } from "../../utils/response/email/resetPassword.template";
import {
  BadRequestException,
  NotFoundException,
} from "../../utils/response/error.response";
import crypto from "crypto";
import { EmailTemplate } from "../../utils/response/email/email.types";
import { compareHash, hashString } from "../../utils/security/hash.security";
import { successResponse } from "../../utils/response/success.response";
import { Types } from "mongoose";

export const resetPasswordRequest = async (
  req: ForgetPasswordRequest,
  res: Response
) => {
  const { email } = req.body;
  const user = await UserModel.findOne({ email });
  if (!user) throw new BadRequestException("Invalid email provided");

  const resetToken = createRandomToken();

  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  user.passwordResetToken = hashedToken;
  user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

  const template: EmailTemplate = getResetPasswordTemplate(resetUrl);

  try {
    await sendEmail({
      email: user.email,
      ...template,
    });
  } catch (error) {
    console.log("\n==================================================");
    console.log("SMTP email sending skipped or failed.");
    console.log(`Reset URL: ${resetUrl}`);
    console.log("==================================================\n");
    
    if (!process.env.EMAIL_HOST) {
      return successResponse({ 
        res, 
        message: `Reset link generated (printed to server console): ${resetUrl}` 
      });
    }
    throw error;
  }
  return successResponse({ res, message: "Reset link sent to your email!" });
};

export const resetPasswordConfirm = async (req: Request, res: Response) => {
  const { token } = req.params;
  const { password } = req.body;

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await UserModel.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: new Date() },
  });

  if (!user)
    throw new BadRequestException("Session is invalid or has expired.");

  user.password = await hashString(password);

  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  await user.save();
  return successResponse({
    res,
    message: "Password updated successfully! You can now log in",
  });
};

export interface IRegisterRequest {
  name: string;
  email: string;
  password: string;
}

export const registerUser = async (req: Request, res: Response) => {
  // Register a new user
  const { name, email, password }: IRegisterRequest = req.body;
  if (!name) throw new BadRequestException("No name provided");
  if (!email) throw new BadRequestException("Missing email");
  if (!password) throw new BadRequestException("Missing password");

  const userExists = await UserModel.findOne({ email });
  if (userExists) throw new BadRequestException("Email already registered");

  const hashedPassword = await hashString(password);

  const createdUser = await UserModel.create({
    name,
    email,
    password: hashedPassword,
  });

  // Remove password from response for security
  const userResponse = {
    id: createdUser._id,
    name: createdUser.name,
    email: createdUser.email,
    isVerified: createdUser.isVerified,
    createdAt: createdUser.createdAt,
  };

  return successResponse({
    res,
    statusCode: 201,
    message: "User registered successfully",
    data: userResponse,
  });
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body as LoginRequest;

  const user = await UserModel.findOne({ email }).select("+password");

  if (!user) {
    throw new NotFoundException("User Not Exist");
  }

  if (!user.isVerified) {
    throw new BadRequestException("Please Verify Your Email To Login");
  }

  if (!(await compareHash(password, user.password as string))) {
    throw new BadRequestException("Email Or Password Incorrect");
  }

  const credentials = generateTokens(user._id as Types.ObjectId);

  setTokenCookie(res, credentials);

  return successResponse({
    res,
    info: "Credentials Saved In User Cookies",
  });
};

export const logout = async (req: Request, res: Response) => {
  clearTokenCookie(res);
  return successResponse({
    res,
    message: "Logged out successfully",
  });
};

export const verifyEmail = async (req: Request, res: Response) => {
  const { email } = req.body;

  const user = await UserModel.findOne({ email });

  if (!user) {
    throw new NotFoundException("User Not Exist");
  }

  user.isVerified = true;
  await user.save();

  return successResponse({
    res,
    message: "Email verified successfully! You can now log in",
  });
};
///====>operations for service provider management by admin <========
// Add a new service provider
export const addServiceProvider = async (req: Request, res: Response) => {
  const { name, email, password, service } = req.body;

  if (!name || !email || !password || !service) {
    throw new BadRequestException("Missing required fields");
  }
  await UserModel.findOne({ email });
  const userExists = await UserModel.findOne({ email });
  if (userExists) throw new BadRequestException("Email already registered");

  const hashedPassword = await hashString(password);
  const createdUser = await UserModel.create({
    name,
    email,
    password: hashedPassword,
    service,
    role: "service_provider"
  });
  return successResponse({
    res,
    statusCode: 201,
    message: "Service provider added successfully",
    data: createdUser,
  });
};
// Get all service providers
export const getServiceProviders = async (req: Request, res: Response) => {
  const { service } = req.query;
  let serviceProviders;
  if (service) {
    serviceProviders = await UserModel.find({ role: "service_provider", service });
  } else {
    serviceProviders = await UserModel.find({ role: "service_provider" });
  }
  return successResponse({
    res,
    message: "Service providers retrieved successfully",
    data: serviceProviders,
  });
};
// Get a specific service provider by ID
export const getServiceProviderById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const serviceProvider = await UserModel.findById(id);
  return successResponse({
    res,
    message: "Service provider retrieved successfully",
    data: serviceProvider,
  });
};
// Update a service provider by ID
export const updateServiceProvider = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, email, service } = req.body;
  const updatedServiceProvider = await UserModel.findByIdAndUpdate(
    id,
    { name, email, service },
    { new: true }
  );
  return successResponse({
    res,
    message: "Service provider updated successfully",
    data: updatedServiceProvider,
  });
};
//patch update a service provider by ID
export const patchUpdateServiceProvider = async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;
  const updatedServiceProvider = await UserModel.findByIdAndUpdate(
    id,
    updateData,
    { new: true }
  );
  return successResponse({
    res,
    message: "Service provider updated successfully",
    data: updatedServiceProvider,
  });
};
// Delete a service provider by ID
export const deleteServiceProvider = async (req: Request, res: Response) => {
  const { id } = req.params;
  await UserModel.findByIdAndDelete(id);
  return successResponse({
    res,
    message: "Service provider deleted successfully",
  });
};