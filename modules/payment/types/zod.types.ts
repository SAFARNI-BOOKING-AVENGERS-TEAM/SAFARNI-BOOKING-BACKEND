import { z } from "zod";

export const CreatePaymentIntentSchema = z.object({
  body: z.strictObject({
    bookingId: z.string().min(1, "bookingId is required"),
  }),
});

export const ConfirmPaymentSchema = z.object({
  body: z.strictObject({
    paymentIntentId: z.string().min(1, "paymentIntentId is required"),
  }),
});