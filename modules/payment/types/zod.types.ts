import { z } from "zod";

const paymentTarget = z.strictObject({
  bookingId: z.string().min(1).optional(),
  packageBookingId: z.string().min(1).optional(),
  esimOrderId: z.string().min(1).optional(),
}).refine(
  (data) => [data.bookingId, data.packageBookingId, data.esimOrderId].filter(Boolean).length === 1,
  { message: "Provide exactly one of bookingId, packageBookingId, or esimOrderId" }
);

export const CreatePaymentIntentSchema = z.object({
  body: paymentTarget,
});

export const CreateCheckoutSessionSchema = z.object({
  body: paymentTarget,
});

export const ConfirmPaymentSchema = z.object({
  body: z.strictObject({
    paymentIntentId: z.string().min(1, "paymentIntentId is required"),
  }),
});
