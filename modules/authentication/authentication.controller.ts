import { Router } from "express";
import {
  resetPasswordRequest,
  resetPasswordConfirm,
  login,
  verifyEmail,
  registerUser,
  logout,
  refreshAccessToken
} from "./authentication.service";
import { validateRequest } from "../../middleware/requestValidation.middleware";
import {
  resetPasswordRequestSchema,
  resetPasswordConfirmSchema,
  LoginSchema,
  verifyEmailSchema,
  RegisterSchema,
} from "./types/zod.types";
import { asyncHandler } from "../../utils/response/async.handler";

const authRouter = Router();

authRouter.post(
  "/signup",
  validateRequest(RegisterSchema),
  asyncHandler(registerUser)
);

authRouter.post(
  "/login",
  validateRequest(LoginSchema),
  asyncHandler(login)
);

authRouter.post(
  "/refresh-token",
  asyncHandler(refreshAccessToken)
);

authRouter.post(
  "/logout",
  asyncHandler(logout)
);

authRouter.post(
  "/forgot-password/request",
  validateRequest(resetPasswordRequestSchema),
  asyncHandler(resetPasswordRequest)
);

authRouter.post(
  "/forgot-password/confirm/:token",
  validateRequest(resetPasswordConfirmSchema),
  asyncHandler(resetPasswordConfirm)
);

authRouter.post(
  "/verify-email/:token",
  validateRequest(verifyEmailSchema),
  asyncHandler(verifyEmail)
);

export default authRouter;
