import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { adminMiddleware } from "../../middleware/admin.middleware";
import { authorizeRoles } from "../../middleware/admin.middleware";
import { asyncHandler } from "../../utils/response/async.handler";
import { validateRequest } from "../../middleware/requestValidation.middleware";
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

// Apply authMiddleware to all booking routes
bookingRouter.use(authMiddleware);

// Create a booking
bookingRouter.post(
  "/",
  validateRequest(CreateBookingSchema),
  asyncHandler(createBooking)
);

// Get logged-in user's bookings
bookingRouter.get(
  "/my-bookings",
  asyncHandler(getMyBookings)
);

// Get single booking details
bookingRouter.get(
  "/:bookingId",
  asyncHandler(getBookingDetails)
);

// Cancel a booking
bookingRouter.patch(
  "/:bookingId/cancel",
  asyncHandler(cancelBooking)
);
// Update booking status (admin or provider)
bookingRouter.patch(
  "/:bookingId/status",
  authorizeRoles("admin", "provider"),
  validateRequest(UpdateBookingStatusSchema),
  asyncHandler(updateBookingStatus)
);

bookingRouter.get(
  "/admin/stats/by-category",
  adminMiddleware,
  asyncHandler(async (req, res) => {
    const result = await getBookingsByCategory();
    return successResponse({ res, message: "Bookings by category", data: result });
  })
);

bookingRouter.get(
  "/admin/stats/revenue",
  adminMiddleware,
  asyncHandler(async (req, res) => {
    const result = await getRevenueByCategory();
    return successResponse({ res, message: "Revenue by category", data: result });
  })
);

bookingRouter.get(
  "/admin/stats/by-status",
  adminMiddleware,
  asyncHandler(async (req, res) => {
    const result = await getBookingsByStatus();
    return successResponse({ res, message: "Bookings by status", data: result });
  })
);

export default bookingRouter;
