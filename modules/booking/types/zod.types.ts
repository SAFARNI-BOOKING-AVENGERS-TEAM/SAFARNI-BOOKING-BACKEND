import { z } from "zod";

export const CreateBookingSchema = z.object({
  body: z
    .strictObject({
      category: z.enum(["tours", "flights", "cars", "hotels"], {
        message: "Category is required",
      }),
      itemId: z.string({ message: "Item ID is required" }).min(1, "Item ID cannot be empty"),
      startDate: z.string({ message: "Start date is required" }).refine((val) => !isNaN(Date.parse(val)), {
        message: "Start date must be a valid date string",
      }),
      endDate: z.string({ message: "End date is required" }).refine((val) => !isNaN(Date.parse(val)), {
        message: "End date must be a valid date string",
      }),
      details: z.record(z.string(), z.any()).optional(),
    })
    .refine((data) => new Date(data.endDate).getTime() > new Date(data.startDate).getTime(), {
      message: "End date must be after start date",
      path: ["endDate"],
    }),
});

export const UpdateBookingStatusSchema = z.object({
  body: z.strictObject({
    status: z.enum(["pending", "confirmed", "cancelled"], {
      message: "Status is required",
    }),
  }),
});
