import { setTokenCookie, clearTokenCookie } from "./../../utils/cookies/cookies";
import { generateTokens, verifyToken, TokenType } from "./../../utils/security/token.security";
import { Request, Response } from "express";
import { ForgetPasswordRequest, LoginRequest } from "./types/request.types";
import UserModel from "../../DB/models/user.model";
import { createRandomToken } from "../../utils/security/jwtToken.security";
import { sendEmail } from "../../utils/response/email/sendEmail.email";
import { getResetPasswordTemplate } from "../../utils/response/email/resetPassword.template";
import { getVerifyEmailTemplate } from "../../utils/response/email/verifyEmail.template";
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

  const userExists = await UserModel.findOne({ email });
  if (userExists) throw new BadRequestException("Email already registered");

  const hashedPassword = await hashString(password);

  const verificationToken = createRandomToken();
  const hashedVerificationToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  const createdUser = await UserModel.create({
    name,
    email,
    password: hashedPassword,
    emailVerificationToken: hashedVerificationToken,
    emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
  });

  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
  const template: EmailTemplate = getVerifyEmailTemplate(verifyUrl);

  // Mirrors resetPasswordRequest's pattern exactly: try to actually send
  // it, and only fall back to a console-logged link if EMAIL_HOST isn't
  // configured. If EMAIL_HOST *is* set and sending still fails (bad
  // credentials, etc.), that's a real misconfiguration and should surface
  // as an error rather than be silently swallowed.
  let devFallbackMessage: string | undefined;

  try {
    await sendEmail({
      email: createdUser.email,
      ...template,
    });
  } catch (error) {
    console.log("\n==================================================");
    console.error("Email send error:", error);
    console.log("SMTP email sending skipped or failed.");
    console.log(`Verify Email URL: ${verifyUrl}`);
    console.log("==================================================\n");

    if (!process.env.EMAIL_HOST) {
      devFallbackMessage = `Verification link generated (printed to server console): ${verifyUrl}`;
    } else {
      throw error;
    }
  }

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
    message:
      devFallbackMessage ??
      "User registered successfully. Please check your email to verify your account.",
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

const credentials = generateTokens(user._id, user.refreshTokenVersion);

  setTokenCookie(res, credentials);

return successResponse({
  res,
  message: "Login successful",
  data: {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
    },
  },
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
  const { token } = req.params;

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await UserModel.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpires: { $gt: new Date() },
  });

  if (!user) {
    throw new BadRequestException("Verification link is invalid or has expired");
  }

  user.isVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

return successResponse({
  res,
  message: "Email verified successfully",
});
};

export const refreshAccessToken = async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refresh_token;

  if (!refreshToken) {
    throw new UnAuthorizedException("Refresh token not found");
  }

  const { decoded, user } = await verifyToken(refreshToken, TokenType.refresh);

  if (decoded.v !== user.refreshTokenVersion) {
    throw new UnAuthorizedException(
      "Refresh token has been revoked. Please login again."
    );
  }

  // Rotate: bump the version so this refresh token can never be used again
  user.refreshTokenVersion += 1;
  await user.save();

  const credentials = generateTokens(user._id, user.refreshTokenVersion);
  setTokenCookie(res, credentials);

  return successResponse({
    res,
    message: "Token refreshed successfully",
  });
};