import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
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
} from "./booking.service";

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

// Admin-only: Update booking status
bookingRouter.patch(
  "/admin/:bookingId/status",
  validateRequest(UpdateBookingStatusSchema),
  asyncHandler(updateBookingStatus)
);

export default bookingRouter;
