import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { adminMiddleware } from "../../middleware/admin.middleware";
import { authorizeRoles } from "../../middleware/admin.middleware";
import { asyncHandler } from "../../utils/response/async.handler";
import { validateRequest } from "../../middleware/requestValidation.middleware";
import { requireSucceededPaymentForConfirmation } from "../../middleware/paidBookingConfirmation.middleware";
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
  asyncHandler(updateBookingStatus)
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
