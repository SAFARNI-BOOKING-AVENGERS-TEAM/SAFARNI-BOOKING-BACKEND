import { stripeClient } from "../../utils/payment/stripeClient";
import PaymentModel from "../../DB/models/payment.model";
import BookingModel from "../../DB/models/booking.model";
import { NotFoundException, BadRequestException, ForbiddenException } from "../../utils/response/error.response";
import { sendNotification } from "../../utils/notifications/sendNotification";

// Stripe expects amounts in the smallest currency unit (cents for USD)
const toCents = (amount: number) => Math.round(amount * 100);

export const createPaymentIntent = async (userId: string, bookingId: string) => {
  const booking = await BookingModel.findById(bookingId);
  if (!booking) {
    throw new NotFoundException("Booking not found");
  }
  if (booking.userId.toString() !== userId.toString()) {
    throw new ForbiddenException("You are not authorized to pay for this booking");
  }
  if (booking.status === "cancelled") {
    throw new BadRequestException("Cannot pay for a cancelled booking");
  }

  // Prevent creating a second payment for a booking that's already paid
  const existingPayment = await PaymentModel.findOne({
    bookingId,
    status: "succeeded",
  });
  if (existingPayment) {
    throw new BadRequestException("This booking has already been paid for");
  }

const paymentIntent = await stripeClient.paymentIntents.create({
    amount: toCents(booking.totalPrice),
    currency: "usd",
    payment_method_types: ["card"],
    metadata: { bookingId, userId: userId.toString() },
  });

  await PaymentModel.create({
    userId,
    bookingId,
    amount: booking.totalPrice,
    currency: "usd",
    stripePaymentIntentId: paymentIntent.id,
    status: "pending",
  });

  return {
    clientSecret: paymentIntent.client_secret,
    amount: booking.totalPrice,
    currency: "usd",
  };
};

export const confirmPayment = async (userId: string, paymentIntentId: string) => {
  const payment = await PaymentModel.findOne({ stripePaymentIntentId: paymentIntentId });
  if (!payment) {
    throw new NotFoundException("Payment record not found");
  }
  if (payment.userId.toString() !== userId.toString()) {
    throw new ForbiddenException("You are not authorized to confirm this payment");
  }

  // Ask Stripe directly — never trust the client's word that payment succeeded
  const intent = await stripeClient.paymentIntents.retrieve(paymentIntentId);

  if (intent.status !== "succeeded") {
    throw new BadRequestException(
      `Payment has not succeeded yet (current status: ${intent.status})`
    );
  }

  payment.status = "succeeded";
  await payment.save();

  if (payment.bookingId) {
    const booking = await BookingModel.findById(payment.bookingId);
    if (booking && booking.status !== "confirmed") {
      booking.status = "confirmed";
      await booking.save();

      await sendNotification(userId, {
        title: "Payment Successful",
        message: `Your payment of $${payment.amount} was successful, and your booking is now confirmed.`,
        type: "booking_status_changed",
        relatedId: booking._id.toString(),
      });
    }
  }

  return payment;
};