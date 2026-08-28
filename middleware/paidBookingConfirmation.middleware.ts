import type { NextFunction, Request, Response } from "express";
import BookingModel from "../DB/models/booking.model";
import PaymentModel from "../DB/models/payment.model";
import { BadRequestException, NotFoundException } from "../utils/response/error.response";

// Booking status remains pending | confirmed | cancelled. Stripe owns payment
// truth: succeeded payment confirms the booking, paid bookings cannot be moved
// back to pending, and cancelled bookings are terminal.
export const requireSucceededPaymentForConfirmation = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const targetStatus = req.body?.status;
    if (!targetStatus || !["pending", "confirmed", "cancelled"].includes(targetStatus)) {
      return next();
    }

    const bookingId = String(req.params.bookingId);
    const booking = await BookingModel.findById(bookingId).select("status packageBookingId");
    if (!booking) throw new NotFoundException("Booking not found");

    if (booking.status === "cancelled" && targetStatus !== "cancelled") {
      throw new BadRequestException("A cancelled booking cannot be reopened");
    }

    if (targetStatus === "cancelled") return next();

    const payment = await PaymentModel.findOne({
      status: "succeeded",
      ...(booking.packageBookingId
        ? { packageBookingId: booking.packageBookingId }
        : { bookingId }),
    }).select("_id");

    if (targetStatus === "confirmed" && !payment) {
      throw new BadRequestException("Booking cannot be confirmed until Stripe payment succeeds");
    }

    if (targetStatus === "pending" && payment) {
      throw new BadRequestException("A paid booking cannot be moved back to pending");
    }

    return next();
  } catch (error) {
    return next(error);
  }
};
