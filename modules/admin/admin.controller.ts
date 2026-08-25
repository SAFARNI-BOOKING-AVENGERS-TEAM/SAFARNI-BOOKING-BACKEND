import { Router, Request, Response } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/admin.middleware";
import { asyncHandler } from "../../utils/response/async.handler";
import { successResponse } from "../../utils/response/success.response";
import * as usersService from "../users/users.service";
import { getAdminDashboardStats } from "./admin.service";

const adminRouter = Router();

// Admin can change a user's role
// PATCH /admin/users/:id/role
adminRouter.patch(
  "/users/:id/role",
  authMiddleware,
  authorizeRoles("admin"),
  asyncHandler(usersService.updateUserRole)
);

// Admin dashboard: unified stats (users, services, bookings, revenue)
// GET /admin/dashboard/stats
adminRouter.get(
  "/dashboard/stats",
  authMiddleware,
  authorizeRoles("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await getAdminDashboardStats();
    return successResponse({
      res,
      message: "Admin dashboard stats retrieved successfully",
      data: stats,
    });
  })
);

export default adminRouter;