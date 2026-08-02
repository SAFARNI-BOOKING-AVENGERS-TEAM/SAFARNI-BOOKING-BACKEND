import { z } from "zod";

export const CreatePackageSchema = z.object({
  body: z.strictObject({
    title: z.string().min(3, "Title must be at least 3 characters"),
    description: z.string().optional(),
    coverImage: z.string().url().optional(),
    gallery: z.array(z.string().url()).optional(),
    country: z.string().optional(),
    cities: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    packageType: z
      .enum(["family", "couples", "luxury", "budget", "adventure", "business"])
      .optional(),
    durationLabel: z.string().optional(),
validUntil: z.string().datetime().optional(),
    items: z
      .array(
        z.object({
          category: z.enum(["hotels", "tours", "flights", "cars"]),
          itemId: z.string().min(1),
          order: z.number().int().min(0).optional(),
        })
      )
      .min(2, "A package must include at least 2 items"),
    discountPercentage: z.number().min(1).max(90),
  }),
});

export const BookPackageSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.strictObject({
    items: z
      .array(
        z.object({
          category: z.enum(["hotels", "tours", "flights", "cars"]),
          itemId: z.string().min(1),
          startDate: z.string().min(1),
          endDate: z.string().min(1),
          details: z.any().optional(),
        })
      )
      .min(1),
  }),
});
export const UpdateFeaturedSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.strictObject({
    featured: z.boolean(),
  }),
});