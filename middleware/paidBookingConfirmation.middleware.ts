import type { NextFunction, Request, Response } from "express";
import BookingModel from "../DB/models/booking.model";
import PaymentModel from "../DB/models/payment.model";
import { BadRequestException, NotFoundException } from "../utils/response/error.response";

// Providers/admins may manage booking status, but payment truth belongs to Stripe.
// No manual status endpoint is allowed to confirm an unpaid booking.
export const requireSucceededPaymentForConfirmation = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    if (req.body?.status !== "confirmed") return next();

    const bookingId = String(req.params.bookingId);
    const booking = await BookingModel.findById(bookingId).select("packageBookingId");
    if (!booking) throw new NotFoundException("Booking not found");

    const payment = await PaymentModel.findOne({
      status: "succeeded",
      ...(booking.packageBookingId
        ? { packageBookingId: booking.packageBookingId }
        : { bookingId }),
    }).select("_id");

    if (!payment) {
      throw new BadRequestException("Booking cannot be confirmed until Stripe payment succeeds");
    }

    return next();
  } catch (error) {
    return next(error);
  }
};
