import { stripeClient } from "../../utils/payment/stripeClient";
import PaymentModel from "../../DB/models/payment.model";
import BookingModel from "../../DB/models/booking.model";
import { NotFoundException, BadRequestException, ForbiddenException } from "../../utils/response/error.response";
import { sendNotification } from "../../utils/notifications/sendNotification";

const toCents = (amount: number) => Math.round(amount * 100);

interface CreateIntentInput {
  bookingId?: string;
  packageBookingId?: string;
}

export const createPaymentIntent = async (userId: string, input: CreateIntentInput) => {
  let amount = 0;
  let bookingIds: string[] = [];

  if (input.bookingId) {
    const booking = await BookingModel.findById(input.bookingId);
    if (!booking) {
      throw new NotFoundException("Booking not found");
    }
    if (booking.userId.toString() !== userId.toString()) {
      throw new ForbiddenException("You are not authorized to pay for this booking");
    }
    if (booking.status === "cancelled") {
      throw new BadRequestException("Cannot pay for a cancelled booking");
    }
    amount = booking.totalPrice;
    bookingIds = [booking._id.toString()];
  } else if (input.packageBookingId) {
    const bookings = await BookingModel.find({ packageBookingId: input.packageBookingId });
    if (bookings.length === 0) {
      throw new NotFoundException("No bookings found for this package booking");
    }
    if (bookings.some((b) => b.userId.toString() !== userId.toString())) {
      throw new ForbiddenException("You are not authorized to pay for this package booking");
    }
    if (bookings.some((b) => b.status === "cancelled")) {
      throw new BadRequestException("Cannot pay for a package that includes a cancelled booking");
    }
    amount = bookings.reduce((sum, b) => sum + b.totalPrice, 0);
    bookingIds = bookings.map((b) => b._id.toString());
  }

  // Prevent creating a second payment for something already paid
  const existingPayment = await PaymentModel.findOne({
    ...(input.bookingId ? { bookingId: input.bookingId } : { packageBookingId: input.packageBookingId }),
    status: "succeeded",
  });
  if (existingPayment) {
    throw new BadRequestException("This has already been paid for");
  }

  const paymentIntent = await stripeClient.paymentIntents.create({
    amount: toCents(amount),
    currency: "usd",
    payment_method_types: ["card"],
    metadata: {
      userId: userId.toString(),
      ...(input.bookingId && { bookingId: input.bookingId }),
      ...(input.packageBookingId && { packageBookingId: input.packageBookingId }),
    },
  });

  await PaymentModel.create({
    userId,
    ...(input.bookingId && { bookingId: input.bookingId }),
    ...(input.packageBookingId && { packageBookingId: input.packageBookingId }),
    amount,
    currency: "usd",
    stripePaymentIntentId: paymentIntent.id,
    status: "pending",
  });

  return {
    clientSecret: paymentIntent.client_secret,
    amount,
    currency: "usd",
    bookingsIncluded: bookingIds.length,
  };
};

// Shared by both the manual /payments/confirm endpoint AND the Stripe webhook —
// single source of truth for "what happens when a payment actually succeeds".
export const finalizePayment = async (stripePaymentIntentId: string) => {
  const payment = await PaymentModel.findOne({ stripePaymentIntentId });
  if (!payment || payment.status === "succeeded") {
    return payment; // already handled, or unknown intent — nothing to do
  }

  payment.status = "succeeded";
  await payment.save();

  const query = payment.bookingId
    ? { _id: payment.bookingId }
    : { packageBookingId: payment.packageBookingId };

  const bookings = await BookingModel.find(query);
  for (const booking of bookings) {
    if (booking.status !== "confirmed") {
      booking.status = "confirmed";
      await booking.save();
    }
  }

  if (bookings.length > 0) {
    await sendNotification(payment.userId.toString(), {
      title: "Payment Successful",
      message: payment.packageBookingId
        ? `Your payment of $${payment.amount} was successful, and your package booking (${bookings.length} items) is now confirmed.`
        : `Your payment of $${payment.amount} was successful, and your booking is now confirmed.`,
      type: "booking_status_changed",
      relatedId: (payment.bookingId || payment.packageBookingId)!,
    });
  }

  return payment;
};

export const confirmPayment = async (userId: string, paymentIntentId: string) => {
  const payment = await PaymentModel.findOne({ stripePaymentIntentId: paymentIntentId });
  if (!payment) {
    throw new NotFoundException("Payment record not found");
  }
  if (payment.userId.toString() !== userId.toString()) {
    throw new ForbiddenException("You are not authorized to confirm this payment");
  }

  // Never trust the client's word — verify directly against Stripe
  const intent = await stripeClient.paymentIntents.retrieve(paymentIntentId);
  if (intent.status !== "succeeded") {
    throw new BadRequestException(
      `Payment has not succeeded yet (current status: ${intent.status})`
    );
  }

  return await finalizePayment(paymentIntentId);
};