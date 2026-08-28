import { Router, Request, Response } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import {
  adminMiddleware,
  authorizeRoles,
} from "../../middleware/admin.middleware";
import { asyncHandler } from "../../utils/response/async.handler";
import { validateRequest } from "../../middleware/requestValidation.middleware";
import { requireSucceededPaymentForConfirmation } from "../../middleware/paidBookingConfirmation.middleware";
import { IRequest } from "../../types/request.types";
import { UnAuthorizedException } from "../../utils/response/error.response";
import {
  CreateBookingSchema,
  UpdateBookingStatusSchema,
} from "./types/zod.types";
import {
  createBooking,
  getMyBookings,
  getBookingDetails,
  cancelBooking,
  updateBookingStatus,
  getBookingsByCategory,
  getRevenueByCategory,
  getBookingsByStatus,
} from "./booking.service";
import { cancelBookingAsManager } from "./bookingCancellation.service";
import { successResponse } from "../../utils/response/success.response";

const bookingRouter = Router();

bookingRouter.use(authMiddleware);

bookingRouter.post(
  "/",
  validateRequest(CreateBookingSchema),
  asyncHandler(createBooking)
);

bookingRouter.get(
  "/my-bookings",
  asyncHandler(getMyBookings)
);

bookingRouter.get(
  "/:bookingId",
  asyncHandler(getBookingDetails)
);

bookingRouter.patch(
  "/:bookingId/cancel",
  asyncHandler(cancelBooking)
);

bookingRouter.patch(
  "/:bookingId/status",
  authorizeRoles("admin", "provider"),
  validateRequest(UpdateBookingStatusSchema),
  requireSucceededPaymentForConfirmation,
  asyncHandler(async (req: Request, res: Response) => {
    if (req.body.status !== "cancelled") {
      return updateBookingStatus(req, res);
    }

    const user = (req as IRequest).credentials?.user;
    if (!user || (user.role !== "admin" && user.role !== "provider")) {
      throw new UnAuthorizedException("Authentication credentials not found");
    }

    const actor = user.role === "provider"
      ? { role: "provider" as const, _id: user._id.toString() }
      : { role: "admin" as const, _id: user._id.toString() };

    const result = await cancelBookingAsManager(String(req.params.bookingId), actor);
    return successResponse({
      res,
      message: result.refundIssued
        ? "Booking cancelled and payment refunded successfully"
        : "Booking cancelled successfully; any applicable refund is being reconciled",
      data: result.booking,
    });
  })
);

bookingRouter.get(
  "/admin/stats/by-category",
  adminMiddleware,
  asyncHandler(async (_req, res) => {
    const result = await getBookingsByCategory();
    return successResponse({ res, message: "Bookings by category", data: result });
  })
);

bookingRouter.get(
  "/admin/stats/revenue",
  adminMiddleware,
  asyncHandler(async (_req, res) => {
    const result = await getRevenueByCategory();
    return successResponse({ res, message: "Revenue by category", data: result });
  })
);

bookingRouter.get(
  "/admin/stats/by-status",
  adminMiddleware,
  asyncHandler(async (_req, res) => {
    const result = await getBookingsByStatus();
    return successResponse({ res, message: "Bookings by status", data: result });
  })
);

export default bookingRouter;
