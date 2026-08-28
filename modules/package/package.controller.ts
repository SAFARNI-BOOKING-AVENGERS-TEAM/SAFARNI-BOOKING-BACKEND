import { Router, Request, Response } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/admin.middleware";
import { optionalAuthMiddleware } from "../../middleware/optionalAuth.middleware";
import { asyncHandler } from "../../utils/response/async.handler";
import { successResponse } from "../../utils/response/success.response";
import { validateRequest } from "../../middleware/requestValidation.middleware";
import { UpdateFeaturedSchema, CreatePackageSchema, BookPackageSchema } from "./types/zod.types";
import { BadRequestException } from "../../utils/response/error.response";
import { requireProviderType } from "../../middleware/providerType.middleware";
import {
  createPackage,
  getPackages,
  getPackageDetails,
  updatePackageStatus,
  bookPackage,
  updatePackageFeatured,
} from "./package.service";

const packageRouter = Router();

packageRouter.get(
  "/",
  optionalAuthMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).credentials?.user;
    const packages = await getPackages(user?.role, user?._id);
    return successResponse({ res, message: "Packages retrieved successfully", data: packages });
  })
);

packageRouter.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const data = await getPackageDetails(String(req.params.id));
    return successResponse({ res, message: "Package details retrieved successfully", data });
  })
);

packageRouter.post(
  "/",
  authMiddleware,
  authorizeRoles("admin", "provider"),
  requireProviderType("travel", "both"),
  validateRequest(CreatePackageSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).credentials.user;
    const pkg = await createPackage(req.body, user._id, user.role);
    return successResponse({ res, statusCode: 201, message: "Package created successfully", data: pkg });
  })
);

packageRouter.patch(
  "/:id/status",
  authMiddleware,
  authorizeRoles("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.body;
    if (status !== "approved" && status !== "rejected") {
      throw new BadRequestException("Status must be approved or rejected");
    }
    const adminId = (req as any).credentials.user._id;
    const pkg = await updatePackageStatus(String(req.params.id), status, adminId);
    return successResponse({ res, message: `Package ${status} successfully`, data: pkg });
  })
);

packageRouter.post(
  "/:id/book",
  authMiddleware,
  validateRequest(BookPackageSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).credentials.user._id;
    const result = await bookPackage(String(req.params.id), userId, req.body.items);
    return successResponse({ res, statusCode: 201, message: "Package booked successfully", data: result });
  })
);

packageRouter.patch(
  "/:id/featured",
  authMiddleware,
  authorizeRoles("admin"),
  validateRequest(UpdateFeaturedSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).credentials.user._id;
    const pkg = await updatePackageFeatured(String(req.params.id), req.body.featured, adminId);
    return successResponse({ res, message: "Package featured status updated successfully", data: pkg });
  })
);

export default packageRouter;
