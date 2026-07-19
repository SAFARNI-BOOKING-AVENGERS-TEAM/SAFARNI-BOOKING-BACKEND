import { Router } from "express";
import {
  resetPasswordRequest,
  resetPasswordConfirm,
  login,
  verifyEmail,
  registerUser,
  logout,
  addServiceProvider,
  deleteServiceProvider,
  getServiceProviderById,
  getServiceProviders,
  updateServiceProvider,
  patchUpdateServiceProvider
} from "./authentication.service";
import { validateRequest } from "../../middleware/requestValidation.middleware";
import {
  resetPasswordRequestSchema,
  resetPasswordConfirmSchema,
  LoginSchema,
  verifyEmailSchema,
  addServiceProviderSchema,
  updateServiceProviderSchema,

  patchUpdateServiceProviderSchema
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

// Service Provider Management Routes
 // Add a new service provider
authRouter.post(
  "/service-providers",
  validateRequest(addServiceProviderSchema),
  addServiceProvider
);
// get all service providers
authRouter.get(
  "/service-providers",
  getServiceProviders
);
//get a specific service provider by ID
authRouter.get(
  "/service-providers/:id",
  getServiceProviderById
);
//update a service provider by ID

authRouter.put(
  "/service-providers/:id",
  validateRequest(updateServiceProviderSchema),
  updateServiceProvider
);
//patch update a service provider by ID
authRouter.patch(
  "/service-providers/:id",
  validateRequest(patchUpdateServiceProviderSchema),
  patchUpdateServiceProvider
);
//delete a service provider by ID
authRouter.delete(
  "/service-providers/:id",
  deleteServiceProvider
);
export default authRouter;
