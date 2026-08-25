import { Router } from "express";
import {
  resetPasswordRequest,
  resetPasswordConfirm,
  login,
  verifyEmail,
  registerUser,
  logout,
  refreshToken,
  addServiceProvider,
  deleteServiceProvider,
  getServiceProviderById,
  getServiceProviders,
  updateServiceProvider,
  patchUpdateServiceProvider,
} from "./authentication.service";
import { validateRequest } from "../../middleware/requestValidation.middleware";
import { authMiddleware } from "../../middleware/auth.middleware";
import { adminMiddleware } from "../../middleware/admin.middleware";
import {
  resetPasswordRequestSchema,
  resetPasswordConfirmSchema,
  LoginSchema,
  signupSchema,
  verifyEmailSchema,
  addServiceProviderSchema,
  updateServiceProviderSchema,
  patchUpdateServiceProviderSchema,
} from "./types/zod.types";

const authRouter = Router();

authRouter.post("/forgot-password/request", validateRequest(resetPasswordRequestSchema), resetPasswordRequest);
authRouter.post("/forgot-password/confirm/:token", validateRequest(resetPasswordConfirmSchema), resetPasswordConfirm);
authRouter.post("/signup", validateRequest(signupSchema), registerUser);
authRouter.post("/login", validateRequest(LoginSchema), login);
authRouter.post("/refresh-token", refreshToken);
authRouter.post("/logout", logout);
authRouter.post("/verify-email/:token", validateRequest(verifyEmailSchema), verifyEmail);

// Admin-only provider management
const adminOnly = [authMiddleware, adminMiddleware] as const;
authRouter.post("/service-providers", ...adminOnly, validateRequest(addServiceProviderSchema), addServiceProvider);
authRouter.get("/service-providers", ...adminOnly, getServiceProviders);
authRouter.get("/service-providers/:id", ...adminOnly, getServiceProviderById);
authRouter.put("/service-providers/:id", ...adminOnly, validateRequest(updateServiceProviderSchema), updateServiceProvider);
authRouter.patch("/service-providers/:id", ...adminOnly, validateRequest(patchUpdateServiceProviderSchema), patchUpdateServiceProvider);
authRouter.delete("/service-providers/:id", ...adminOnly, deleteServiceProvider);

export default authRouter;
