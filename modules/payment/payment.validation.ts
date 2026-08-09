import { z } from "zod";
import { Types } from "mongoose";

const objectIdString = z.string().refine((val) => Types.ObjectId.isValid(val), {
  message: "Must be a valid MongoDB ObjectId",
});

// ---- POST /payments/checkout ----
// Exactly one of bookingId / packageBookingId must be provided — never
// both, never neither. This is the request-shape enforcement layer;
// payment.service.ts still re-verifies ownership and status independently
// since validation alone can't check anything that requires a DB read.
export const CreateCheckoutSessionSchema = z.object({
  body: z
    .strictObject({
      bookingId: objectIdString.optional(),
      packageBookingId: z.string().min(1, "packageBookingId cannot be empty").optional(),
    })
    .refine(
      (data) => Boolean(data.bookingId) !== Boolean(data.packageBookingId),
      {
        message:
          "Provide exactly one of bookingId or packageBookingId, not both and not neither",
      }
    ),
});

// ---- GET /payments/:id ----
export const GetPaymentByIdSchema = z.object({
  params: z.strictObject({
    id: objectIdString,
  }),
});

// ---- GET /payments/history ----
export const GetPaymentHistorySchema = z.object({
  query: z.strictObject({
    page: z
      .string()
      .regex(/^\d+$/, "page must be a positive integer")
      .optional(),
    limit: z
      .string()
      .regex(/^\d+$/, "limit must be a positive integer")
      .optional(),
    status: z
      .enum([
        "pending",
        "processing",
        "paid",
        "failed",
        "refunded",
        "partially_refunded",
      ])
      .optional(),
  }),
});

// ---- POST /payments/refund/:paymentId ----
// `amount` omitted = full refund of the remaining refundable balance,
// computed server-side in payment.service.ts (never trust a client-supplied
// full-refund amount either — the same "never trust frontend price"
// principle applies to refunds).
export const RefundPaymentSchema = z.object({
  params: z.strictObject({
    paymentId: objectIdString,
  }),
  body: z.strictObject({
    amount: z
      .number()
      .positive("amount must be greater than 0")
      .optional(),
    reason: z.enum(["duplicate", "fraudulent", "requested_by_customer"], {
      message: "reason is required",
    }),
  }),
});
