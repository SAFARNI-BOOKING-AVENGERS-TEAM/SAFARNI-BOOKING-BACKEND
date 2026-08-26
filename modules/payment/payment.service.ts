import type Stripe from "stripe";
import { getStripeClient } from "../../utils/payment/stripeClient";
import PaymentModel from "../../DB/models/payment.model";
import BookingModel from "../../DB/models/booking.model";
import ESIMOrderModel from "../../DB/models/esimOrder.model";
import { NotFoundException, BadRequestException, ForbiddenException } from "../../utils/response/error.response";
import { sendNotification } from "../../utils/notifications/sendNotification";
import { withLock } from "../../utils/concurrency/lock";
import { fulfillPaidESIMOrder } from "../esim/esim.service";

const toCents = (amount: number) => Math.round(amount * 100);

type PaymentTargetInput = {
  bookingId?: string;
  packageBookingId?: string;
  esimOrderId?: string;
};

type ResolvedTarget = {
  amount: number;
  currency: string;
  label: string;
  bookingIds: string[];
  targetFilter: Record<string, string>;
};

const targetMetadata = (userId: string, input: PaymentTargetInput) => ({
  userId: userId.toString(),
  ...(input.bookingId && { bookingId: input.bookingId }),
  ...(input.packageBookingId && { packageBookingId: input.packageBookingId }),
  ...(input.esimOrderId && { esimOrderId: input.esimOrderId }),
});

const resolvePaymentTarget = async (userId: string, input: PaymentTargetInput): Promise<ResolvedTarget> => {
  if (input.bookingId) {
    const booking = await BookingModel.findById(input.bookingId);
    if (!booking) throw new NotFoundException("Booking not found");
    if (booking.userId.toString() !== userId.toString()) {
      throw new ForbiddenException("You are not authorized to pay for this booking");
    }
    if (booking.status === "cancelled") throw new BadRequestException("Cannot pay for a cancelled booking");

    return {
      amount: booking.totalPrice,
      currency: "usd",
      label: `SAFARNI ${booking.category} booking`,
      bookingIds: [booking._id.toString()],
      targetFilter: { bookingId: input.bookingId },
    };
  }

  if (input.packageBookingId) {
    const bookings = await BookingModel.find({ packageBookingId: input.packageBookingId });
    if (bookings.length === 0) throw new NotFoundException("No bookings found for this package booking");
    if (bookings.some((booking) => booking.userId.toString() !== userId.toString())) {
      throw new ForbiddenException("You are not authorized to pay for this package booking");
    }
    if (bookings.some((booking) => booking.status === "cancelled")) {
      throw new BadRequestException("Cannot pay for a package that includes a cancelled booking");
    }

    return {
      amount: bookings.reduce((sum, booking) => sum + booking.totalPrice, 0),
      currency: "usd",
      label: `SAFARNI travel package (${bookings.length} items)`,
      bookingIds: bookings.map((booking) => booking._id.toString()),
      targetFilter: { packageBookingId: input.packageBookingId },
    };
  }

  if (input.esimOrderId) {
    const order = await ESIMOrderModel.findById(input.esimOrderId);
    if (!order) throw new NotFoundException("eSIM order not found");
    if (order.userId.toString() !== userId.toString()) {
      throw new ForbiddenException("You are not authorized to pay for this eSIM order");
    }
    if (order.status === "cancelled") throw new BadRequestException("Cannot pay for a cancelled eSIM order");
    if (order.status === "completed") throw new BadRequestException("This eSIM order is already completed");

    return {
      amount: order.price,
      currency: (order.currency || "USD").toLowerCase(),
      label: order.planSnapshot?.name ? `SAFARNI eSIM - ${order.planSnapshot.name}` : "SAFARNI eSIM plan",
      bookingIds: [],
      targetFilter: { esimOrderId: input.esimOrderId },
    };
  }

  throw new BadRequestException("A payment target is required");
};

const ensurePayable = async (targetFilter: Record<string, string>) => {
  const paid = await PaymentModel.findOne({ ...targetFilter, status: "succeeded" });
  if (paid) throw new BadRequestException("This item has already been paid for");
};

const finalizePaymentRecord = async (payment: any, suppressFulfillmentError = false) => {
  return await withLock(`payment-finalize:${payment._id.toString()}`, async () => {
    const freshPayment = await PaymentModel.findById(payment._id);
    if (!freshPayment) throw new NotFoundException("Payment record not found");

    const wasAlreadySucceeded = freshPayment.status === "succeeded";
    if (!wasAlreadySucceeded) {
      freshPayment.status = "succeeded";
      await freshPayment.save();
    }

    if (freshPayment.esimOrderId) {
      try {
        const order = await fulfillPaidESIMOrder(freshPayment.esimOrderId);
        return { payment: freshPayment, fulfillmentStatus: order.status };
      } catch (error) {
        if (!suppressFulfillmentError) throw error;
        console.error(`[payment] Paid eSIM ${freshPayment.esimOrderId} still needs provisioning:`, error);
        return { payment: freshPayment, fulfillmentStatus: "failed" };
      }
    }

    const query = freshPayment.bookingId
      ? { _id: freshPayment.bookingId }
      : { packageBookingId: freshPayment.packageBookingId };

    const bookings = await BookingModel.find(query);
    let repairedBookingState = false;
    for (const booking of bookings) {
      if (booking.status !== "confirmed") {
        booking.status = "confirmed";
        await booking.save();
        repairedBookingState = true;
      }
    }

    if (!wasAlreadySucceeded && bookings.length > 0) {
      await sendNotification(freshPayment.userId.toString(), {
        title: "Payment Successful",
        message: freshPayment.packageBookingId
          ? `Your payment of $${freshPayment.amount} was successful, and your package booking (${bookings.length} items) is now confirmed.`
          : `Your payment of $${freshPayment.amount} was successful, and your booking is now confirmed.`,
        type: "booking_status_changed",
        relatedId: (freshPayment.bookingId || freshPayment.packageBookingId)!,
      });
    }

    if (wasAlreadySucceeded && repairedBookingState) {
      console.warn(`[payment] Repaired booking state for succeeded payment ${freshPayment._id}`);
    }

    return { payment: freshPayment, fulfillmentStatus: bookings.length ? "confirmed" : "succeeded" };
  });
};

export const createPaymentIntent = async (userId: string, input: PaymentTargetInput) => {
  const stripeClient = getStripeClient();
  const target = await resolvePaymentTarget(userId, input);
  if (target.amount <= 0) throw new BadRequestException("Invalid payment amount");
  await ensurePayable(target.targetFilter);

  const existingPending = await PaymentModel.findOne({
    ...target.targetFilter,
    status: "pending",
    stripePaymentIntentId: { $exists: true },
  }).sort({ createdAt: -1 });

  if (existingPending?.stripePaymentIntentId && existingPending.stripePaymentIntentId.startsWith("pi_")) {
    try {
      const existingIntent = await stripeClient.paymentIntents.retrieve(existingPending.stripePaymentIntentId);
      if (!["canceled", "succeeded"].includes(existingIntent.status) && existingIntent.client_secret) {
        return {
          clientSecret: existingIntent.client_secret,
          paymentIntentId: existingIntent.id,
          amount: target.amount,
          currency: target.currency,
          bookingsIncluded: target.bookingIds.length,
        };
      }
    } catch {
      // Stale Stripe object: create a fresh intent below.
    }
  }

  const paymentIntent = await stripeClient.paymentIntents.create({
    amount: toCents(target.amount),
    currency: target.currency,
    payment_method_types: ["card"],
    metadata: targetMetadata(userId, input),
  });

  await PaymentModel.create({
    userId,
    ...target.targetFilter,
    amount: target.amount,
    currency: target.currency,
    stripePaymentIntentId: paymentIntent.id,
    status: "pending",
  });

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    amount: target.amount,
    currency: target.currency,
    bookingsIncluded: target.bookingIds.length,
  };
};

export const createCheckoutSession = async (userId: string, input: PaymentTargetInput) => {
  const stripeClient = getStripeClient();
  const target = await resolvePaymentTarget(userId, input);
  if (target.amount <= 0) throw new BadRequestException("Invalid payment amount");
  await ensurePayable(target.targetFilter);

  const existingPending = await PaymentModel.findOne({
    ...target.targetFilter,
    status: "pending",
    stripeCheckoutSessionId: { $exists: true },
  }).sort({ createdAt: -1 });

  if (existingPending?.stripeCheckoutSessionId) {
    try {
      const existingSession = await stripeClient.checkout.sessions.retrieve(existingPending.stripeCheckoutSessionId);
      if (existingSession.status === "open" && existingSession.url) {
        return {
          sessionId: existingSession.id,
          url: existingSession.url,
          amount: target.amount,
          currency: target.currency,
          bookingsIncluded: target.bookingIds.length,
        };
      }
    } catch {
      // Stale/expired session: create a fresh one below.
    }
  }

  const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
  const metadata = targetMetadata(userId, input);
  const cancelParams = new URLSearchParams();
  if (input.bookingId) cancelParams.set("bookingId", input.bookingId);
  if (input.packageBookingId) cancelParams.set("packageBookingId", input.packageBookingId);
  if (input.esimOrderId) cancelParams.set("esimOrderId", input.esimOrderId);
  cancelParams.set("cancelled", "1");

  const session = await stripeClient.checkout.sessions.create({
    mode: "payment",
    client_reference_id: userId.toString(),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: target.currency,
          unit_amount: toCents(target.amount),
          product_data: { name: target.label },
        },
      },
    ],
    metadata,
    payment_intent_data: { metadata },
    success_url: `${frontendUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}/checkout?${cancelParams.toString()}`,
  });

  const payment = existingPending || new PaymentModel({ userId, ...target.targetFilter });
  payment.amount = target.amount;
  payment.currency = target.currency;
  payment.stripeCheckoutSessionId = session.id;
  if (!payment.stripePaymentIntentId || !payment.stripePaymentIntentId.startsWith("pi_")) {
    payment.stripePaymentIntentId = `checkout:${session.id}`;
  }
  payment.status = "pending";
  await payment.save();

  if (!session.url) throw new BadRequestException("Stripe did not return a checkout URL");

  return {
    sessionId: session.id,
    url: session.url,
    amount: target.amount,
    currency: target.currency,
    bookingsIncluded: target.bookingIds.length,
  };
};

export const finalizePayment = async (stripePaymentIntentId: string) => {
  const payment = await PaymentModel.findOne({ stripePaymentIntentId });
  if (!payment) return null;
  return (await finalizePaymentRecord(payment)).payment;
};

export const finalizeCheckoutSession = async (
  session: Stripe.Checkout.Session,
  suppressFulfillmentError = false
) => {
  const payment = await PaymentModel.findOne({ stripeCheckoutSessionId: session.id });
  if (!payment) return null;
  if (session.payment_status !== "paid") return { payment, fulfillmentStatus: "unpaid" };

  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id;

  if (paymentIntentId && payment.stripePaymentIntentId !== paymentIntentId) {
    payment.stripePaymentIntentId = paymentIntentId;
    await payment.save();
  }

  return await finalizePaymentRecord(payment, suppressFulfillmentError);
};

export const verifyCheckoutSession = async (userId: string, sessionId: string) => {
  const stripeClient = getStripeClient();
  const session = await stripeClient.checkout.sessions.retrieve(sessionId);
  const payment = await PaymentModel.findOne({ stripeCheckoutSessionId: sessionId });
  if (!payment) throw new NotFoundException("Payment record not found");
  if (payment.userId.toString() !== userId.toString()) {
    throw new ForbiddenException("You are not authorized to view this checkout session");
  }
  if (session.metadata?.userId && session.metadata.userId !== userId.toString()) {
    throw new ForbiddenException("Checkout session does not belong to this user");
  }

  let fulfillmentStatus: string = payment.status;
  if (session.payment_status === "paid") {
    const finalized = await finalizeCheckoutSession(session, true);
    fulfillmentStatus = finalized?.fulfillmentStatus || "succeeded";
  }

  const refreshedPayment = await PaymentModel.findById(payment._id);

  return {
    sessionId: session.id,
    sessionStatus: session.status,
    paymentStatus: session.payment_status,
    paymentRecordStatus: refreshedPayment?.status || payment.status,
    fulfillmentStatus,
    amount: payment.amount,
    currency: payment.currency,
    bookingId: payment.bookingId,
    packageBookingId: payment.packageBookingId,
    esimOrderId: payment.esimOrderId,
  };
};

export const confirmPayment = async (userId: string, paymentIntentId: string) => {
  const stripeClient = getStripeClient();
  const payment = await PaymentModel.findOne({ stripePaymentIntentId: paymentIntentId });
  if (!payment) throw new NotFoundException("Payment record not found");
  if (payment.userId.toString() !== userId.toString()) {
    throw new ForbiddenException("You are not authorized to confirm this payment");
  }

  const intent = await stripeClient.paymentIntents.retrieve(paymentIntentId);
  if (intent.status !== "succeeded") {
    throw new BadRequestException(`Payment has not succeeded yet (current status: ${intent.status})`);
  }

  return await finalizePayment(paymentIntentId);
};

export const retryPaidESIMProvision = async (userId: string, esimOrderId: string) => {
  const order = await ESIMOrderModel.findById(esimOrderId);
  if (!order) throw new NotFoundException("eSIM order not found");
  if (order.userId.toString() !== userId.toString()) {
    throw new ForbiddenException("You are not authorized to retry this eSIM order");
  }

  const payment = await PaymentModel.findOne({ esimOrderId, userId, status: "succeeded" });
  if (!payment) throw new BadRequestException("A succeeded payment is required before eSIM provisioning");

  return await fulfillPaidESIMOrder(esimOrderId);
};

export const markPaymentFailed = async (stripePaymentIntentId: string) => {
  const payment = await PaymentModel.findOne({ stripePaymentIntentId });
  if (!payment || payment.status === "succeeded") return payment;
  payment.status = "failed";
  await payment.save();
  return payment;
};

export const refundBookingPayment = async (bookingId: string, packageBookingId: string | undefined, amount: number) => {
  const stripeClient = getStripeClient();
  const payment = await PaymentModel.findOne({
    status: "succeeded",
    ...(packageBookingId ? { packageBookingId } : { bookingId }),
  });

  if (!payment?.stripePaymentIntentId || !payment.stripePaymentIntentId.startsWith("pi_")) return null;
  const alreadyRefunded = payment.refunds.some((refund: any) => refund.bookingId === bookingId);
  if (alreadyRefunded) return null;

  const refund = await stripeClient.refunds.create({
    payment_intent: payment.stripePaymentIntentId,
    amount: Math.round(amount * 100),
  });

  payment.refunds.push({
    bookingId,
    amount,
    stripeRefundId: refund.id,
    createdAt: new Date(),
  });
  await payment.save();
  return refund;
};
