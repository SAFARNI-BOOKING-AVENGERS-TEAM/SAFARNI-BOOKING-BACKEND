import { setTokenCookie, clearTokenCookie } from "./../../utils/cookies/cookies";
import { generateTokens, verifyToken, TokenType } from "./../../utils/security/token.security";
import { Request, Response } from "express";
import UserModel from "../../DB/models/user.model";
import { createRandomToken } from "../../utils/security/jwtToken.security";
import { sendEmail } from "../../utils/response/email/sendEmail.email";
import { getResetPasswordTemplate } from "../../utils/response/email/resetPassword.template";
import {
  BadRequestException,
  NotFoundException,
  UnAuthorizedException,
} from "../../utils/response/error.response";
import crypto from "crypto";
import { EmailTemplate } from "../../utils/response/email/email.types";
import { compareHash, hashString } from "../../utils/security/hash.security";
import { successResponse } from "../../utils/response/success.response";
import { Types } from "mongoose";

const genericResetMessage = "If an account exists for that email, a reset link has been sent.";
const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

const sendVerificationEmail = async (email: string, token: string) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${token}`;
  await sendEmail({
    email,
    subject: "Verify your SAFARNI email",
    message: `Verify your email: ${verificationUrl}`,
    html: `<p>Welcome to SAFARNI.</p><p><a href="${verificationUrl}">Verify your email</a></p><p>This link expires in 30 minutes.</p>`,
  });
};

export const resetPasswordRequest = async (req: Request, res: Response) => {
  const { email } = req.body;
  const user = await UserModel.findOne({ email });
  if (!user) return successResponse({ res, message: genericResetMessage });

  const resetToken = createRandomToken();
  user.passwordResetToken = hashToken(resetToken);
  user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
  const template: EmailTemplate = getResetPasswordTemplate(resetUrl);

  try {
    await sendEmail({ email: user.email, ...template });
  } catch (error) {
    if (process.env.NODE_ENV === "development" && !process.env.EMAIL_HOST) {
      console.warn(`[dev-only] Reset URL: ${resetUrl}`);
    } else {
      throw error;
    }
  }

  return successResponse({ res, message: genericResetMessage });
};

export const resetPasswordConfirm = async (req: Request, res: Response) => {
  const token = String(req.params.token);
  const { password } = req.body;

  const user = await UserModel.findOne({
    passwordResetToken: hashToken(token),
    passwordResetExpires: { $gt: new Date() },
  });
  if (!user) throw new BadRequestException("Session is invalid or has expired.");

  user.password = await hashString(password);
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.refreshTokenVersion += 1;
  await user.save();

  clearTokenCookie(res);
  return successResponse({ res, message: "Password updated successfully! You can now log in" });
};

export const registerUser = async (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  const userExists = await UserModel.findOne({ email });
  if (userExists) throw new BadRequestException("Email already registered");

  const verificationToken = createRandomToken();
  const createdUser = await UserModel.create({
    name,
    email,
    password: await hashString(password),
    emailVerificationToken: hashToken(verificationToken),
    emailVerificationExpires: new Date(Date.now() + 30 * 60 * 1000),
  });

  try {
    await sendVerificationEmail(createdUser.email, verificationToken);
  } catch (error) {
    if (process.env.NODE_ENV === "development" && !process.env.EMAIL_HOST) {
      console.warn(`[dev-only] Verification URL: ${process.env.FRONTEND_URL}/verify-email/${verificationToken}`);
    } else {
      throw error;
    }
  }

  return successResponse({
    res,
    statusCode: 201,
    message: "User registered successfully. Please verify your email.",
    data: {
      id: createdUser._id,
      name: createdUser.name,
      email: createdUser.email,
      isVerified: createdUser.isVerified,
      createdAt: createdUser.createdAt,
    },
  });
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await UserModel.findOne({ email }).select("+password");

  if (!user || !(await compareHash(password, user.password as string))) {
    throw new UnAuthorizedException("Email or password is incorrect");
  }
  if (!user.isVerified) throw new BadRequestException("Please verify your email to login");

  const credentials = generateTokens(user._id as Types.ObjectId, user.refreshTokenVersion);
  setTokenCookie(res, credentials);

  return successResponse({
    res,
    message: "Logged in successfully",
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        providerType: user.providerType,
        isVerified: user.isVerified,
        profilePicture: user.profilePicture,
      },
    },
  });
};

export const refreshToken = async (req: Request, res: Response) => {
  const token = req.cookies?.refresh_token;
  if (!token) throw new UnAuthorizedException("Refresh token is missing");

  const { user, decoded } = await verifyToken(token, TokenType.refresh);
  if (decoded.v !== user.refreshTokenVersion) {
    clearTokenCookie(res);
    throw new UnAuthorizedException("Refresh token has been revoked");
  }

  user.refreshTokenVersion += 1;
  await user.save();
  const credentials = generateTokens(user._id as Types.ObjectId, user.refreshTokenVersion);
  setTokenCookie(res, credentials);
  return successResponse({ res, message: "Session refreshed" });
};

export const logout = async (req: Request, res: Response) => {
  const refreshTokenValue = req.cookies?.refresh_token;
  if (refreshTokenValue) {
    try {
      const { user } = await verifyToken(refreshTokenValue, TokenType.refresh);
      user.refreshTokenVersion += 1;
      await user.save();
    } catch {
      // Always clear cookies even when the supplied refresh token is invalid.
    }
  }
  clearTokenCookie(res);
  return successResponse({ res, message: "Logged out successfully" });
};

export const verifyEmail = async (req: Request, res: Response) => {
  const token = String(req.params.token);
  const user = await UserModel.findOne({
    emailVerificationToken: hashToken(token),
    emailVerificationExpires: { $gt: new Date() },
  });
  if (!user) throw new BadRequestException("Verification link is invalid or has expired");

  user.isVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();
  return successResponse({ res, message: "Email verified successfully! You can now log in" });
};

export const addServiceProvider = async (req: Request, res: Response) => {
  const { name, email, password, providerType } = req.body;
  if (await UserModel.findOne({ email })) throw new BadRequestException("Email already registered");

  const createdUser = await UserModel.create({
    name,
    email,
    password: await hashString(password),
    role: "provider",
    providerType,
    isVerified: true,
  });

  return successResponse({ res, statusCode: 201, message: "Service provider added successfully", data: createdUser });
};

export const getServiceProviders = async (req: Request, res: Response) => {
  const query: Record<string, unknown> = { role: "provider" };
  if (req.query.providerType) query.providerType = req.query.providerType;
  const serviceProviders = await UserModel.find(query);
  return successResponse({ res, message: "Service providers retrieved successfully", data: serviceProviders });
};

export const getServiceProviderById = async (req: Request, res: Response) => {
  const serviceProvider = await UserModel.findOne({ _id: req.params.id, role: "provider" });
  if (!serviceProvider) throw new NotFoundException("Service provider not found");
  return successResponse({ res, message: "Service provider retrieved successfully", data: serviceProvider });
};

export const updateServiceProvider = async (req: Request, res: Response) => {
  const { name, email, providerType } = req.body;
  const updatedServiceProvider = await UserModel.findOneAndUpdate(
    { _id: req.params.id, role: "provider" },
    { name, email, providerType },
    { new: true, runValidators: true }
  );
  if (!updatedServiceProvider) throw new NotFoundException("Service provider not found");
  return successResponse({ res, message: "Service provider updated successfully", data: updatedServiceProvider });
};

export const patchUpdateServiceProvider = async (req: Request, res: Response) => {
  const updatedServiceProvider = await UserModel.findOneAndUpdate(
    { _id: req.params.id, role: "provider" },
    { $set: req.body },
    { new: true, runValidators: true }
  );
  if (!updatedServiceProvider) throw new NotFoundException("Service provider not found");
  return successResponse({ res, message: "Service provider updated successfully", data: updatedServiceProvider });
};

export const deleteServiceProvider = async (req: Request, res: Response) => {
  const deleted = await UserModel.findOneAndDelete({ _id: req.params.id, role: "provider" });
  if (!deleted) throw new NotFoundException("Service provider not found");
  return successResponse({ res, message: "Service provider deleted successfully" });
};
