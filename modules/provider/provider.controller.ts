import { Router, Request, Response } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/admin.middleware";
import { asyncHandler } from "../../utils/response/async.handler";
import { successResponse } from "../../utils/response/success.response";
import { getProviderDashboardStats } from "./provider.service";

const providerRouter = Router();

providerRouter.get(
  "/dashboard/stats",
  authMiddleware,
  authorizeRoles("provider"),
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

export default providerRouter;