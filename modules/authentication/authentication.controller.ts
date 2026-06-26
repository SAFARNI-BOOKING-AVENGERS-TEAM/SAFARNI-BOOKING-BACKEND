import { Router } from "express";
import {
  resetPasswordRequest,
  resetPasswordConfirm,
  login,
  verifyEmail,
  registerUser,
  logout,
} from "./authentication.service";
import { validateRequest } from "../../middleware/requestValidation.middleware";
import {
  resetPasswordRequestSchema,
  resetPasswordConfirmSchema,
  LoginSchema,
  verifyEmailSchema,
} from "./types/zod.types";

const authRouter = Router();

authRouter.post(
  "/forgot-password/request",
  validateRequest(resetPasswordRequestSchema),
  resetPasswordRequest
);

authRouter.post(
  "/forgot-password/confirm/:token",
  validateRequest(resetPasswordConfirmSchema),
  resetPasswordConfirm
);

authRouter.post("/signup", registerUser);

authRouter.post("/login", validateRequest(LoginSchema), login);

authRouter.post("/logout", logout);

authRouter.post(
  "/verify-email",
  validateRequest(verifyEmailSchema),
  verifyEmail
);

export default authRouter;
