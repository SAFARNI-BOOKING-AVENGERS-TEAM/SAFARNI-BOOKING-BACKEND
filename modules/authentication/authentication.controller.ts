import { Router } from "express";
import {
  resetPasswordRequest,
  resetPasswordConfirm,
  login,
} from "./authentication.service";
import { validateRequest } from "../../middleware/requestValidation.middleware";
import {
  resetPasswordRequestSchema,
  resetPasswordConfirmSchema,
  LoginSchema,
} from "./types/zod.types";
import { registerUser } from "./authentication.service";

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
export default authRouter;
