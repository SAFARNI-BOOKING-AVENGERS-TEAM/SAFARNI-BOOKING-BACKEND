import mongoose, { Types } from "mongoose";
import { IBooking } from "../../DB/models/booking.model";
import { IPayment, PaymentStatus } from "../../DB/models/payment.model";
import { IRefund, RefundReason } from "../../DB/models/refund.model";
import { stripeClient } from "./stripe.service";
import paymentRepository from "./payment.repository";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "../../utils/response/error.response";
import {
  CheckoutSessionResult,
  CheckoutTarget,
  CreateCheckoutSessionDTO,
} from "./interfaces/payment.interfaces";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

/**
 * USD is 2-decimal ("minor unit" = cent). The platform only supports USD
 * today (see BookingCurrency), but this conversion is isolated here on
 * purpose: several currencies Stripe supports are zero-decimal (JPY, KRW...)
 * where amount*100 would be a real, silent 100x pricing bug. Adding a
 * currency later means widening this switch, not hunting for every place
 * that assumed "* 100".
 */
function toStripeMinorUnits(amount: number, currency: "USD"): number {
  switch (currency) {
    case "USD":
      return Math.round(amount * 100);
    default: {
      const _exhaustive: never = currency;
      throw new BadRequestException(`Unsupported currency: ${_exhaustive}`);
    }
  }
}

function bookingLineItemLabel(booking: IBooking): string {
  const categoryLabel =
    booking.category.charAt(0).toUpperCase() + booking.category.slice(1);
  const start = booking.startDate.toISOString().slice(0, 10);
  const end = booking.endDate.toISOString().slice(0, 10);
  return `${categoryLabel} booking (${start} → ${end})`;
}

/**
 * Resolves what's being paid for and computes the amount FROM the stored
 * Booking document(s) — never from anything the client sent. Also verifies
 * ownership and that every booking is in a payable state.
 */
async function resolveCheckoutTarget(
  userId: Types.ObjectId,
  dto: Pick<CreateCheckoutSessionDTO, "bookingId" | "packageBookingId">
): Promise<CheckoutTarget> {
  let bookings: IBooking[];

  if (dto.bookingId) {
    const booking = await paymentRepository.findBookingById(
      new Types.ObjectId(dto.bookingId)
    );
    if (!booking) {
      throw new NotFoundException("Booking not found");
    }
    bookings = [booking];
  } else if (dto.packageBookingId) {
    bookings = await paymentRepository.findBookingsByPackageId(
      dto.packageBookingId
    );
    if (bookings.length === 0) {
      throw new NotFoundException("Package booking not found");
    }
  } else {
    // Unreachable given payment.validation.ts's XOR refine, but the
    // service must not trust that the validation layer was actually
    // wired up on every call path (e.g. a future internal caller).
    throw new BadRequestException(
      "Provide exactly one of bookingId or packageBookingId"
    );
  }

  for (const booking of bookings) {
    if (booking.userId.toString() !== userId.toString()) {
      // Matches the ownership-check convention used in
      // booking.service.ts (getBookingDetails/cancelBooking).
      throw new ForbiddenException(
        "You are not authorized to pay for this booking"
      );
    }
    if (booking.status === "cancelled") {
      throw new BadRequestException(
        `Booking ${booking._id} has been cancelled and can no longer be paid for`
      );
    }
    if (!["unpaid", "failed"].includes(booking.$assertPopulated("paymentStatus") as PaymentStatus)) {
      throw new ConflictException(
        `Booking ${booking._id} is already ${booking.paymentStatus  === "pending" ? "awaiting payment" : booking.paymentStatus}`
      );
    }
  }

  const amount =
    Math.round(bookings.reduce((sum, b) => sum + b.totalPrice, 0) * 100) /
    100;

  return {
    bookings,
    bookingId: dto.bookingId ? new Types.ObjectId(dto.bookingId) : null,
    packageBookingId: dto.packageBookingId ?? null,
    amount,
  };
}

/**
 * If there's already a live (non-expired) pending Checkout Session for
 * this exact target, hand back its URL instead of creating a new one.
 * Re-clicking "Pay" — a second tab, a slow connection, an impatient
 * double-click — should resume the existing attempt, not spawn a second
 * Stripe Checkout Session for the same money.
 */
async function findReusableSession(
  target: CheckoutTarget
): Promise<CheckoutSessionResult | null> {
  const existing = target.bookingId
    ? await paymentRepository.findActiveByBookingId(target.bookingId)
    : await paymentRepository.findActiveByPackageBookingId(
        target.packageBookingId as string
      );

  if (!existing) return null;

  if (existing.paymentStatus === "paid") {
    throw new ConflictException("This booking has already been paid for");
  }
  if (existing.paymentStatus === "processing") {
    throw new ConflictException(
      "A payment for this booking is currently processing"
    );
  }

  // paymentStatus === "pending" from here on.
  const notExpired =
    existing.checkoutExpiresAt && existing.checkoutExpiresAt > new Date();

  if (existing.stripeCheckoutSessionId && notExpired) {
    const session = await stripeClient.checkout.sessions.retrieve(
      existing.stripeCheckoutSessionId
    );
    if (session.status === "open" && session.url) {
      return {
        paymentId: (existing._id as Types.ObjectId).toString(),
        checkoutUrl: session.url,
        expiresAt: existing.checkoutExpiresAt as Date,
      };
    }
  }

  // The previous attempt expired or Stripe no longer considers it open —
  // free it up so a new one can be created instead of blocking forever
  // on the partial unique index.
  await paymentRepository.updateStatus(
    existing._id as Types.ObjectId,
    "failed",
    { failureReason: "Checkout session expired before completion" }
  );
  await paymentRepository.setBookingsPaymentStatus(
    target.bookings.map((b) => b._id as Types.ObjectId),
    "unpaid"
  );

  return null;
}

export async function createCheckoutSession(
  dto: CreateCheckoutSessionDTO
): Promise<CheckoutSessionResult> {
  const target = await resolveCheckoutTarget(dto.userId, dto);

  const reusable = await findReusableSession(target);
  if (reusable) return reusable;

  const bookingIds = target.bookings.map((b) => b._id as Types.ObjectId);

  // ⚠️ TRANSACTION REQUIRED: this needs MongoDB running as a replica set
  // (or Atlas). On a standalone instance, session.startTransaction() below
  // throws immediately. See the architecture review for how to enable
  // this locally (`mongod --replSet rs0` + `rs.initiate()`) — do this
  // before deploying, not after something breaks in production.
  const dbSession = await mongoose.startSession();
  let paymentId: Types.ObjectId;

  try {
    dbSession.startTransaction();

    const preGeneratedId = new Types.ObjectId();

    const payment = await paymentRepository.createPayment(
      {
        _id: preGeneratedId,
        userId: dto.userId,
        bookingId: target.bookingId,
        packageBookingId: target.packageBookingId,
        amount: target.amount,
        idempotencyKey: `checkout_${preGeneratedId}`,
      },
      dbSession
    );

    await paymentRepository.linkPaymentToBookings(
      bookingIds,
      payment._id as Types.ObjectId,
      "pending",
      dbSession
    );

    await dbSession.commitTransaction();
    paymentId = payment._id as Types.ObjectId;
  } catch (err: any) {
    await dbSession.abortTransaction();
    if (err?.code === 11000) {
      throw new ConflictException(
        "A payment for this booking is already in progress"
      );
    }
    throw err;
  } finally {
    dbSession.endSession();
  }

  // Deliberately outside the transaction: an external HTTP call must never
  // sit inside a Mongo transaction (holds locks for the round-trip time,
  // and Stripe's own retry isn't rollback-able anyway). The Payment row
  // created above is the recovery point if this call fails.
  try {
    const session = await stripeClient.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: dto.userEmail,
        client_reference_id: dto.userId.toString(),
        line_items: target.bookings.map((booking) => ({
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: toStripeMinorUnits(booking.totalPrice, "USD"),
            product_data: {
              name: bookingLineItemLabel(booking),
              metadata: {
                bookingId: (booking._id as Types.ObjectId).toString(),
              },
            },
          },
        })),
        metadata: {
          paymentId: paymentId.toString(),
          userId: dto.userId.toString(),
          ...(target.bookingId && { bookingId: target.bookingId.toString() }),
          ...(target.packageBookingId && {
            packageBookingId: target.packageBookingId,
          }),
        },
        payment_intent_data: {
          metadata: { paymentId: paymentId.toString() },
        },
        success_url: `${FRONTEND_URL}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${FRONTEND_URL}/booking-cancel?payment_id=${paymentId.toString()}`,
      },
      { idempotencyKey: `checkout_${paymentId}` }
    );

    if (!session.url) {
      throw new Error("Stripe did not return a Checkout Session URL");
    }

    const expiresAt = new Date(session.expires_at * 1000);

    await paymentRepository.attachCheckoutSession(
      paymentId,
      session.id,
      expiresAt
    );

    return {
      paymentId: paymentId.toString(),
      checkoutUrl: session.url,
      expiresAt,
    };
  } catch (err: any) {
    // Free up the partial unique index so the user can retry, and roll
    // the denormalized Booking.paymentStatus back so it doesn't get stuck
    // showing "pending" forever for a checkout session that never existed.
    await paymentRepository.updateStatus(paymentId, "failed", {
      failureReason:
        err?.message || "Stripe checkout session creation failed",
    });
    await paymentRepository.setBookingsPaymentStatus(bookingIds, "unpaid");
    throw err;
  }
}

// ============================================================
// PART 2 — webhook-driven status transitions, refunds, reads
// ============================================================

export interface CreateRefundDTO {
  paymentId: Types.ObjectId;
  requesterId: Types.ObjectId;
  isPrivileged: boolean; // admin/provider — can refund payments they don't own
  amount?: number; // omitted = full remaining refundable balance
  reason: RefundReason;
}

export interface RefundResult {
  refundId: string;
  amount: number;
  status: string;
  remainingBalance: number;
}

/**
 * Called from webhook.controller.ts once a Checkout Session's payment is
 * confirmed (checkout.session.completed with payment_status "paid", or
 * checkout.session.async_payment_succeeded for delayed payment methods).
 * Idempotent: if the Payment is already "paid", this is a no-op — Stripe's
 * at-least-once delivery means the same success event can arrive twice
 * even after WebhookEvent-level dedup catches most repeats (e.g. two
 * different event IDs both confirming the same underlying payment).
 */
export async function markPaymentPaid(
  stripeCheckoutSessionId: string,
  stripePaymentIntentId: string,
  stripeCustomerId: string | null
): Promise<void> {
  const payment = await paymentRepository.findByCheckoutSessionId(
    stripeCheckoutSessionId
  );
  if (!payment) {
    // Genuinely unexpected — a session Stripe knows about that we have no
    // Payment record for. Log and stop; there's nothing safe to update.
    throw new NotFoundException(
      `No Payment found for Stripe Checkout Session ${stripeCheckoutSessionId}`
    );
  }

  if (payment.paymentStatus === "paid") return; // idempotent no-op

  const bookingIds = (
    await paymentRepository.findBookingsByPaymentId(payment._id as Types.ObjectId)
  ).map((b) => b._id as Types.ObjectId);

  const dbSession = await mongoose.startSession(); // ⚠️ TRANSACTION REQUIRED — see part 1
  try {
    dbSession.startTransaction();

    await paymentRepository.updateStatus(
      payment._id as Types.ObjectId,
      "paid",
      { stripePaymentIntentId, stripeCustomerId },
      dbSession
    );

    // Payment success auto-confirms the booking(s) — matches the flow you
    // specified (Update Payment Status → Update Booking Status). If your
    // platform instead wants a human provider to confirm bookings even
    // after payment clears, drop the `status: "confirmed"` line below and
    // only update paymentStatus.
    await paymentRepository.updateBookingsAfterPayment(
      bookingIds,
      { paymentStatus: "paid", status: "confirmed" },
      dbSession
    );

    await dbSession.commitTransaction();
  } catch (err) {
    await dbSession.abortTransaction();
    throw err;
  } finally {
    dbSession.endSession();
  }
}

/**
 * Called for checkout.session.expired, checkout.session.async_payment_failed,
 * and any other event indicating the payment definitively did not go
 * through. Frees the booking(s) back to "unpaid" so the customer can retry.
 */
export async function markPaymentFailed(
  stripeCheckoutSessionId: string,
  failureReason: string
): Promise<void> {
  const payment = await paymentRepository.findByCheckoutSessionId(
    stripeCheckoutSessionId
  );
  if (!payment) {
    throw new NotFoundException(
      `No Payment found for Stripe Checkout Session ${stripeCheckoutSessionId}`
    );
  }

  if (["paid", "failed", "refunded", "partially_refunded"].includes(payment.paymentStatus)) {
    return; // already terminal (or already paid) — nothing to fail
  }

  const bookingIds = (
    await paymentRepository.findBookingsByPaymentId(payment._id as Types.ObjectId)
  ).map((b) => b._id as Types.ObjectId);

  const dbSession = await mongoose.startSession(); // ⚠️ TRANSACTION REQUIRED — see part 1
  try {
    dbSession.startTransaction();
    await paymentRepository.updateStatus(
      payment._id as Types.ObjectId,
      "failed",
      { failureReason },
      dbSession
    );
    await paymentRepository.setBookingsPaymentStatus(
      bookingIds,
      "unpaid",
      dbSession
    );
    await dbSession.commitTransaction();
  } catch (err) {
    await dbSession.abortTransaction();
    throw err;
  } finally {
    dbSession.endSession();
  }
}

export async function createRefund(
  dto: CreateRefundDTO
): Promise<RefundResult> {
  const payment = await paymentRepository.findById(dto.paymentId);
  if (!payment) throw new NotFoundException("Payment not found");

  if (!dto.isPrivileged && payment.userId.toString() !== dto.requesterId.toString()) {
    throw new ForbiddenException("You are not authorized to refund this payment");
  }

  if (!["paid", "partially_refunded"].includes(payment.paymentStatus)) {
    throw new ConflictException(
      `Payment is ${payment.paymentStatus} and has no captured funds to refund`
    );
  }
  if (!payment.stripePaymentIntentId) {
    // Should be impossible given the paymentStatus check above, but a
    // refund request is exactly the wrong place to assume that.
    throw new ConflictException("Payment has no associated Stripe charge");
  }

  // Never trust a client-supplied refund amount beyond "does it fit
  // within what's left" — same principle as checkout amount calculation.
  const remainingBalance =
    Math.round((payment.amount - payment.refundedAmount) * 100) / 100;
  if (remainingBalance <= 0) {
    throw new ConflictException("This payment has already been fully refunded");
  }

  const refundAmount = dto.amount ?? remainingBalance;
  if (refundAmount > remainingBalance) {
    throw new BadRequestException(
      `Refund amount (${refundAmount}) exceeds the remaining refundable balance (${remainingBalance})`
    );
  }

  const preGeneratedId = new Types.ObjectId();
  const idempotencyKey = `refund_${preGeneratedId}`;

  const stripeRefund = await stripeClient.refunds.create(
    {
      payment_intent: payment.stripePaymentIntentId,
      amount: toStripeMinorUnits(refundAmount, "USD"),
      reason: dto.reason,
      metadata: { paymentId: payment._id!.toString(), refundId: preGeneratedId.toString() },
    },
    { idempotencyKey }
  );

  const newRefundedAmount =
    Math.round((payment.refundedAmount + refundAmount) * 100) / 100;
  const newPaymentStatus: Extract<PaymentStatus, "refunded" | "partially_refunded"> =
    newRefundedAmount >= payment.amount ? "refunded" : "partially_refunded";

  const bookingIds = (
    await paymentRepository.findBookingsByPaymentId(payment._id as Types.ObjectId)
  ).map((b) => b._id as Types.ObjectId);

  const dbSession = await mongoose.startSession(); // ⚠️ TRANSACTION REQUIRED — see part 1
  try {
    dbSession.startTransaction();

    await paymentRepository.createRefund(
      {
        paymentId: payment._id as Types.ObjectId,
        bookingId: payment.bookingId ?? null,
        packageBookingId: payment.packageBookingId ?? null,
        initiatedBy: dto.requesterId,
        amount: refundAmount,
        reason: dto.reason,
        stripeRefundId: stripeRefund.id,
        status: stripeRefund.status as IRefund["status"],
        idempotencyKey,
      },
      dbSession
    );

    await paymentRepository.incrementRefundedAmount(
      payment._id as Types.ObjectId,
      refundAmount,
      newPaymentStatus,
      dbSession
    );

    // Deliberately NOT touching Booking.status (fulfilment) here — a
    // refund is a money event, cancelling the booking is a separate,
    // deliberate fulfilment decision made through the booking module.
    await paymentRepository.setBookingsPaymentStatus(
      bookingIds,
      newPaymentStatus,
      dbSession
    );

    await dbSession.commitTransaction();
  } catch (err) {
    await dbSession.abortTransaction();
    throw err;
  } finally {
    dbSession.endSession();
  }

  return {
    refundId: stripeRefund.id,
    amount: refundAmount,
    status: stripeRefund.status ?? "unknown",
    remainingBalance:
      Math.round((payment.amount - newRefundedAmount) * 100) / 100,
  };
}

export async function getPaymentById(
  paymentId: Types.ObjectId,
  requesterId: Types.ObjectId,
  isPrivileged: boolean
): Promise<IPayment> {
  const payment = await paymentRepository.findById(paymentId);
  if (!payment) throw new NotFoundException("Payment not found");

  if (!isPrivileged && payment.userId.toString() !== requesterId.toString()) {
    throw new ForbiddenException("You are not authorized to view this payment");
  }

  return payment;
}

export async function getPaymentHistory(
  userId: Types.ObjectId,
  filters: { status?: PaymentStatus; page?: number; limit?: number }
): Promise<{ items: IPayment[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(50, Math.max(1, filters.limit ?? 10));

  const { items, total } = await paymentRepository.findHistory({
    userId,
    status: filters.status,
    page,
    limit,
  });

  return { items, total, page, limit };
}
