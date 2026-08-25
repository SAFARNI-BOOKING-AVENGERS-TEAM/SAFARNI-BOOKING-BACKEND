import { Router, Request, Response } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/admin.middleware";
import { asyncHandler } from "../../utils/response/async.handler";
import { successResponse } from "../../utils/response/success.response";
import * as usersService from "../users/users.service";
import {
  getAdminAuditLogs,
  getAdminBookings,
  getAdminDashboardStats,
  getAdminServices,
  getAdminUsers,
  updateAdminBookingStatus,
  updateAdminServiceStatus,
} from "./admin.service";

const adminRouter = Router();
const adminOnly = [authMiddleware, authorizeRoles("admin")] as const;

adminRouter.get(
  "/dashboard/stats",
  ...adminOnly,
  asyncHandler(async (_req: Request, res: Response) => {
    const stats = await getAdminDashboardStats();
    return successResponse({ res, message: "Admin dashboard stats retrieved successfully", data: stats });
  })
);

adminRouter.get(
  "/users",
  ...adminOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await getAdminUsers(req.query as Record<string, unknown>);
    return successResponse({ res, message: "Users retrieved successfully", data });
  })
);

adminRouter.patch(
  "/users/:id/role",
  ...adminOnly,
  asyncHandler(usersService.updateUserRole)
);

adminRouter.get(
  "/services",
  ...adminOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await getAdminServices(req.query as Record<string, unknown>);
    return successResponse({ res, message: "Services retrieved successfully", data });
  })
);

adminRouter.patch(
  "/services/:type/:id/status",
  ...adminOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await updateAdminServiceStatus(String(req.params.type), String(req.params.id), String(req.body.status));
    return successResponse({ res, message: `Service status updated to ${req.body.status}`, data });
  })
);

adminRouter.get(
  "/bookings",
  ...adminOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await getAdminBookings(req.query as Record<string, unknown>);
    return successResponse({ res, message: "Bookings retrieved successfully", data });
  })
);

adminRouter.patch(
  "/bookings/:id/status",
  ...adminOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await updateAdminBookingStatus(String(req.params.id), String(req.body.status));
    return successResponse({ res, message: `Booking status updated to ${req.body.status}`, data });
  })
);

adminRouter.get(
  "/audit-logs",
  ...adminOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await getAdminAuditLogs(req.query as Record<string, unknown>);
    return successResponse({ res, message: "Audit logs retrieved successfully", data });
  })
);

export default adminRouter;