import { ClientSession, Types } from "mongoose";
import PaymentModel, { IPayment, PaymentStatus } from "../../DB/models/payment.model";
import RefundModel, { IRefund } from "../../DB/models/refund.model";
import WebhookEventModel, {
  IWebhookEvent,
} from "../../DB/models/webhook-event.model";
import BookingModel, {
  IBooking,
  BookingPaymentStatus,
} from "../../DB/models/booking.model";

export interface CreatePaymentInput {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  bookingId?: Types.ObjectId | null;
  packageBookingId?: string | null;
  amount: number;
  idempotencyKey: string;
  checkoutExpiresAt?: Date | null;
}

export interface CreateRefundInput {
  paymentId: Types.ObjectId;
  bookingId?: Types.ObjectId | null;
  packageBookingId?: string | null;
  initiatedBy: Types.ObjectId;
  amount: number;
  reason: IRefund["reason"];
  stripeRefundId: string;
  status: IRefund["status"];
  idempotencyKey: string;
}

export interface PaymentHistoryFilter {
  userId: Types.ObjectId;
  status?: PaymentStatus;
  page: number;
  limit: number;
}

class PaymentRepository {
  // ---- Payment ----

  async createPayment(
    input: CreatePaymentInput,
    session?: ClientSession
  ): Promise<IPayment> {
    const [payment] = await PaymentModel.create(
      [
        {
          _id: input._id,
          userId: input.userId,
          bookingId: input.bookingId ?? null,
          packageBookingId: input.packageBookingId ?? null,
          amount: input.amount,
          idempotencyKey: input.idempotencyKey,
          checkoutExpiresAt: input.checkoutExpiresAt ?? null,
        },
      ],
      { session }
    );
    return payment;
  }

  async findById(
    paymentId: Types.ObjectId | string,
    session?: ClientSession
  ): Promise<IPayment | null> {
    return PaymentModel.findById(paymentId).session(session ?? null);
  }

  async findByIdempotencyKey(
    idempotencyKey: string,
    session?: ClientSession
  ): Promise<IPayment | null> {
    return PaymentModel.findOne({ idempotencyKey }).session(session ?? null);
  }

  async findByCheckoutSessionId(
    stripeCheckoutSessionId: string,
    session?: ClientSession
  ): Promise<IPayment | null> {
    return PaymentModel.findOne({ stripeCheckoutSessionId }).session(
      session ?? null
    );
  }

  async findByPaymentIntentId(
    stripePaymentIntentId: string,
    session?: ClientSession
  ): Promise<IPayment | null> {
    return PaymentModel.findOne({ stripePaymentIntentId }).session(
      session ?? null
    );
  }

  /** Active = not yet in a terminal failed/refunded state; used for the double-payment guard alongside the DB partial unique index. */
  async findActiveByBookingId(
    bookingId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IPayment | null> {
    return PaymentModel.findOne({
      bookingId,
      paymentStatus: { $in: ["pending", "processing", "paid"] },
    }).session(session ?? null);
  }

  async findActiveByPackageBookingId(
    packageBookingId: string,
    session?: ClientSession
  ): Promise<IPayment | null> {
    return PaymentModel.findOne({
      packageBookingId,
      paymentStatus: { $in: ["pending", "processing", "paid"] },
    }).session(session ?? null);
  }

  async attachCheckoutSession(
    paymentId: Types.ObjectId,
    stripeCheckoutSessionId: string,
    checkoutExpiresAt: Date,
    session?: ClientSession
  ): Promise<IPayment | null> {
    return PaymentModel.findByIdAndUpdate(
      paymentId,
      { stripeCheckoutSessionId, checkoutExpiresAt },
      { new: true, session }
    );
  }

  async updateStatus(
    paymentId: Types.ObjectId,
    paymentStatus: PaymentStatus,
    extra: Partial<
      Pick<
        IPayment,
        "stripePaymentIntentId" | "stripeCustomerId" | "failureReason"
      >
    > = {},
    session?: ClientSession
  ): Promise<IPayment | null> {
    return PaymentModel.findByIdAndUpdate(
      paymentId,
      { paymentStatus, ...extra },
      { new: true, session }
    );
  }

  async incrementRefundedAmount(
    paymentId: Types.ObjectId,
    amount: number,
    newStatus: Extract<PaymentStatus, "refunded" | "partially_refunded">,
    session?: ClientSession
  ): Promise<IPayment | null> {
    return PaymentModel.findByIdAndUpdate(
      paymentId,
      { $inc: { refundedAmount: amount }, $set: { paymentStatus: newStatus } },
      { new: true, session }
    );
  }

  async findHistory(
    filter: PaymentHistoryFilter
  ): Promise<{ items: IPayment[]; total: number }> {
    const query: Record<string, unknown> = { userId: filter.userId };
    if (filter.status) query.paymentStatus = filter.status;

    const skip = (filter.page - 1) * filter.limit;

    const [items, total] = await Promise.all([
      PaymentModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(filter.limit),
      PaymentModel.countDocuments(query),
    ]);

    return { items, total };
  }

  // ---- Refund ----

  async createRefund(
    input: CreateRefundInput,
    session?: ClientSession
  ): Promise<IRefund> {
    const [refund] = await RefundModel.create(
      [
        {
          paymentId: input.paymentId,
          bookingId: input.bookingId ?? null,
          packageBookingId: input.packageBookingId ?? null,
          initiatedBy: input.initiatedBy,
          amount: input.amount,
          reason: input.reason,
          stripeRefundId: input.stripeRefundId,
          status: input.status,
          idempotencyKey: input.idempotencyKey,
        },
      ],
      { session }
    );
    return refund;
  }

  async findRefundsByPaymentId(
    paymentId: Types.ObjectId
  ): Promise<IRefund[]> {
    return RefundModel.find({ paymentId }).sort({ createdAt: -1 });
  }

  // ---- Booking (checkout-target lookup + Payment linkage) ----

  async findBookingById(
    bookingId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IBooking | null> {
    return BookingModel.findById(bookingId).session(session ?? null);
  }

  async findBookingsByPackageId(
    packageBookingId: string,
    session?: ClientSession
  ): Promise<IBooking[]> {
    return BookingModel.find({ packageBookingId }).session(session ?? null);
  }

  async findBookingsByPaymentId(
    paymentId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IBooking[]> {
    return BookingModel.find({ paymentId }).session(session ?? null);
  }

  async linkPaymentToBookings(
    bookingIds: Types.ObjectId[],
    paymentId: Types.ObjectId,
    paymentStatus: BookingPaymentStatus,
    session?: ClientSession
  ): Promise<void> {
    await BookingModel.updateMany(
      { _id: { $in: bookingIds } },
      { paymentId, paymentStatus },
      { session }
    );
  }

  async updateBookingsAfterPayment(
    bookingIds: Types.ObjectId[],
    update: { paymentStatus: BookingPaymentStatus; status?: IBooking["status"] },
    session?: ClientSession
  ): Promise<void> {
    await BookingModel.updateMany(
      { _id: { $in: bookingIds } },
      update,
      { session }
    );
  }

  async setBookingsPaymentStatus(
    bookingIds: Types.ObjectId[],
    paymentStatus: BookingPaymentStatus,
    session?: ClientSession
  ): Promise<void> {
    await BookingModel.updateMany(
      { _id: { $in: bookingIds } },
      { paymentStatus },
      { session }
    );
  }

  // ---- WebhookEvent (idempotency ledger) ----

  async findWebhookEventByStripeId(
    stripeEventId: string
  ): Promise<IWebhookEvent | null> {
    return WebhookEventModel.findOne({ stripeEventId });
  }

  /**
   * Throws MongoDB's E11000 duplicate-key error if this event was already
   * recorded — that thrown error IS the idempotency check. Callers should
   * catch it specifically (see webhook.controller.ts) rather than querying
   * for existence first, which would leave a race window between the query
   * and the insert.
   */
  async recordWebhookEvent(
    stripeEventId: string,
    type: string,
    livemode: boolean,
    objectSnapshot: Record<string, unknown> | null
  ): Promise<IWebhookEvent> {
    return WebhookEventModel.create({
      stripeEventId,
      type,
      livemode,
      objectSnapshot,
      status: "received",
    });
  }

  async markWebhookEventProcessed(stripeEventId: string): Promise<void> {
    await WebhookEventModel.updateOne(
      { stripeEventId },
      { status: "processed", processedAt: new Date() }
    );
  }

  async markWebhookEventFailed(
    stripeEventId: string,
    error: string
  ): Promise<void> {
    await WebhookEventModel.updateOne(
      { stripeEventId },
      { status: "failed", error }
    );
  }
}

export const paymentRepository = new PaymentRepository();
export default paymentRepository;
