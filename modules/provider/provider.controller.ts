import { Router, Request, Response } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/admin.middleware";
import { asyncHandler } from "../../utils/response/async.handler";
import { successResponse } from "../../utils/response/success.response";
import { getProviderDashboardStats } from "./provider.service";
import { getProviderOperations } from "./provider.operations.service";

const providerRouter = Router();

providerRouter.use(authMiddleware, authorizeRoles("provider"));

providerRouter.get(
  "/dashboard/stats",
  asyncHandler(async (req: Request, res: Response) => {
    const providerId = (req as any).credentials.user._id;
    const stats = await getProviderDashboardStats(providerId);
    return successResponse({
      res,
      message: "Provider dashboard stats retrieved successfully",
      data: stats,
    });
  })
);

providerRouter.get(
  "/operations",
  asyncHandler(async (req: Request, res: Response) => {
    const providerId = (req as any).credentials.user._id;
    const data = await getProviderOperations(providerId);
    return successResponse({
      res,
      message: "Provider bookings and eSIM orders retrieved successfully",
      data,
    });
  })
);

export default providerRouter;
