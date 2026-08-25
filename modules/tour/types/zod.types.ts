import { z } from "zod";

const LocationSchema = z.object({
  name: z
    .string()
    .min(1, "Location name is required"),

  country: z
    .string()
    .min(1, "Country is required"),

  city: z
    .string()
    .optional(),
});

const PriceTierSchema = z.object({
  type: z
    .string()
    .min(1, "Price tier type is required"),

  price: z
    .number()
    .positive(
      "Price must be a positive number"
    ),
});

const StartDateSchema = z.object({
  date: z.coerce.date(),

  capacity: z
    .number()
    .int()
    .positive(
      "Capacity must be a positive integer"
    ),
});

const ProviderInfoSchema = z.object({
  name: z
    .string()
    .min(1, "Provider name is required"),

  contact: z
    .string()
    .optional(),
});

<<<<<<< HEAD
// ====================
// CREATE TOUR
// ====================
=======
// CREATE TOUR
>>>>>>> origin/main
export const CreateTourSchema = z.object({
  body: z.strictObject({
    title: z.string().min(
      3,
      "Title must be at least 3 characters"
    ),

    slug: z.string().min(
      3,
      "Slug must be at least 3 characters"
    ),

    summary: z.string().min(
      10,
      "Summary must be at least 10 characters"
    ),

    fullDescription: z.string().optional(),

    mainImage: z.string().url(
      "mainImage must be a valid URL"
    ),

    gallery: z.array(
      z.string().url()
    ).optional(),

    startDates: z.array(
      StartDateSchema
    ).optional(),

    duration: z.string().min(
      1,
      "Duration is required"
    ),

    highlights: z.array(
      z.string()
    ).optional(),

    activities: z.array(
      z.string()
    ).optional(),

    locations: z.array(
      LocationSchema
    ).min(
      1,
      "At least one location is required"
    ),

    priceTiers: z.array(
      PriceTierSchema
    ).min(
      1,
      "At least one price tier is required"
    ),

    inclusiveItems: z.array(
      z.string()
    ).optional(),

    exclusiveItems: z.array(
      z.string()
    ).optional(),

    cancellationPolicy:
      z.string().optional(),

    languages: z.array(
      z.string()
    ).min(
      1,
      "At least one language is required"
    ),

    difficulty:
      z.string().optional(),

    providerInfo:
      ProviderInfoSchema,

    tags: z.array(
      z.string()
    ).optional(),

    recommended:
      z.boolean().optional(),
  }),
});

export const UpdateTourSchema = z.object({
  params: z.object({
    id: z.string().min(
      1,
      "Tour ID is required"
    ),
  }),

  body:
    CreateTourSchema
      .shape
      .body
      .partial(),
});
<<<<<<< HEAD
=======
// ADD REVIEW
export const AddReviewSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Tour ID is required"),
  }),
  body: z.strictObject({
    rating: z.number().int().min(1, "Rating must be between 1 and 5").max(5, "Rating must be between 1 and 5"),
    comment: z.string().max(500, "Comment must be under 500 characters").optional(),
  }),
});
>>>>>>> origin/main
