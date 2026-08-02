import { Router, Request, Response } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/admin.middleware";
import { optionalAuthMiddleware } from "../../middleware/optionalAuth.middleware";
import { asyncHandler } from "../../utils/response/async.handler";
import { successResponse } from "../../utils/response/success.response";
import { validateRequest } from "../../middleware/requestValidation.middleware";
import { BadRequestException } from "../../utils/response/error.response";
import { CreatePackageSchema, BookPackageSchema } from "./types/zod.types";
import {
  createPackage,
  getPackages,
  getPackageDetails,
  updatePackageStatus,
  bookPackage,
} from "./package.service";

const packageRouter = Router();

// GET /packages — browse packages (guest sees approved only)
packageRouter.get(
  "/",
  optionalAuthMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).credentials?.user;
    const packages = await getPackages(user?.role, user?._id);
    return successResponse({ res, message: "Packages retrieved successfully", data: packages });
  })
);

// GET /packages/:id — full details with resolved item info
packageRouter.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const data = await getPackageDetails(req.params.id);
    return successResponse({ res, message: "Package details retrieved successfully", data });
  })
);

// POST /packages — Admin or Provider (own services only) creates a package
packageRouter.post(
  "/",
  authMiddleware,
  authorizeRoles("admin", "provider"),
  validateRequest(CreatePackageSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).credentials.user;
    const pkg = await createPackage(req.body, user._id, user.role);
    return successResponse({ res, statusCode: 201, message: "Package created successfully", data: pkg });
  })
);

// PATCH /packages/:id/status — Admin approves/rejects
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
    const pkg = await updatePackageStatus(req.params.id, status, adminId);
    return successResponse({ res, message: `Package ${status} successfully`, data: pkg });
  })
);

// POST /packages/:id/book — any authenticated user books the package
packageRouter.post(
  "/:id/book",
  authMiddleware,
  validateRequest(BookPackageSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).credentials.user._id;
    const result = await bookPackage(req.params.id, userId, req.body.items);
    return successResponse({
      res,
      statusCode: 201,
      message: "Package booked successfully",
      data: result,
    });
  })
);

export default packageRouter;