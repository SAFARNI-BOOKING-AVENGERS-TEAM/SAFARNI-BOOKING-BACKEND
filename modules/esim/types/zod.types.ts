import { z } from "zod";

export const CreateESIMPlanSchema = z.object({
  body: z.strictObject({
    name: z.string().min(3, "Name must be at least 3 characters"),
    country: z.string().min(2, "Country is required"),
    region: z.string().optional(),
    dataAmount: z.number().positive("Data amount must be a positive number"),
    dataUnit: z.enum(["MB", "GB", "Unlimited"]).optional(),
    validityDays: z.number().int().positive("Validity days must be a positive integer"),
    price: z.number().positive("Price must be a positive number"),
    currency: z.string().length(3, "Currency must be a 3-letter code (e.g. USD)").optional(),
  }),
});

export const UpdateESIMPlanSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: CreateESIMPlanSchema.shape.body.partial(),
});

export const UpdateESIMPlanStatusSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.strictObject({
    status: z.enum(["approved", "rejected"]),
  }),
});
export const PurchaseESIMSchema = z.object({
  body: z.strictObject({
    planId: z.string().min(1, "planId is required"),
    packageBookingId: z.string().optional(),
  }),
});