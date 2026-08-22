import { Router } from "express";
import {
  resetPasswordRequest,
  resetPasswordConfirm,
  login,
  verifyEmail,
  registerUser,
  logout,
  refreshAccessToken,
  addServiceProvider,
  getServiceProviders,
  
  patchUpdateServiceProvider,
  deleteServiceProvider,
  getServiceProviderById,
  updateServiceProvider,
} from "./authentication.service";
import { validateRequest } from "../../middleware/requestValidation.middleware";
import {
  resetPasswordRequestSchema,
  resetPasswordConfirmSchema,
  LoginSchema,
  verifyEmailSchema,
  RegisterSchema,
  addServiceProviderSchema,
  updateServiceProviderSchema,
  patchUpdateServiceProviderSchema,
 
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

// Service Provider Management Routes
 // Add a new service provider
authRouter.post(
  "/service-providers",
  validateRequest(addServiceProviderSchema),
  asyncHandler(addServiceProvider)
);
// get all service providers
authRouter.get(
  "/service-providers",
  asyncHandler(getServiceProviders)
);

//get a specific service provider by ID
authRouter.get(
  "/service-providers/:id",
  asyncHandler(getServiceProviderById)
);
//update a service provider by ID

authRouter.put(
  "/service-providers/:id",
  validateRequest(updateServiceProviderSchema),
  asyncHandler(updateServiceProvider)
);
//patch update a service provider by ID
authRouter.patch(
  "/service-providers/:id",
  validateRequest(patchUpdateServiceProviderSchema),
  asyncHandler(patchUpdateServiceProvider)
);
//delete a service provider by ID
authRouter.delete(
  "/service-providers/:id",
  asyncHandler(deleteServiceProvider)
);
export default authRouter;
