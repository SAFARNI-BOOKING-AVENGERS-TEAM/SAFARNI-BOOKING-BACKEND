import { z } from "zod";

export const CreatePaymentIntentSchema = z.object({
  body: z.strictObject({
    bookingId: z.string().min(1).optional(),
    packageBookingId: z.string().min(1).optional(),
  }).refine(
    (data) => (!!data.bookingId) !== (!!data.packageBookingId),
    { message: "Provide exactly one of bookingId or packageBookingId, not both or neither" }
  ),
});

export const ConfirmPaymentSchema = z.object({
  body: z.strictObject({
    paymentIntentId: z.string().min(1, "paymentIntentId is required"),
  }),
});