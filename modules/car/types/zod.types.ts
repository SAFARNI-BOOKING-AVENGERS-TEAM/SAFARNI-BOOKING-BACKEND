import { z } from "zod";

export const CreateCarSchema = z.object({
  body: z.strictObject({
    brand: z.string({ message: "Brand is required" }).min(1, "Brand cannot be empty"),
    model: z.string({ message: "Model is required" }).min(1, "Model cannot be empty"),
    year: z.number().optional(),
    type: z.enum(["SUV", "Sedan", "Hatchback", "Convertible", "Luxury"], {
      message: "Invalid car type",
    }),
    transmission: z.enum(["Automatic", "Manual"], {
      message: "Invalid transmission type",
    }),
    fuelType: z.enum(["Petrol", "Diesel", "Electric", "Hybrid"], {
      message: "Invalid fuel type",
    }),
    seats: z.number({ message: "Seats count is required" }).min(1, "Seats must be at least 1"),
    pricePerDay: z.number({ message: "Price per day is required" }).min(0, "Price must be positive"),
    available: z.boolean().optional(),
    location: z.strictObject({
      city: z.string({ message: "City is required" }).min(1, "City cannot be empty"),
      address: z.string().optional(),
    }),
    image: z.string().optional(),
  }),
});

export const UpdateCarSchema = z.object({
  body: z.strictObject({
    brand: z.string().optional(),
    model: z.string().optional(),
    year: z.number().optional(),
    type: z.enum(["SUV", "Sedan", "Hatchback", "Convertible", "Luxury"]).optional(),
    transmission: z.enum(["Automatic", "Manual"]).optional(),
    fuelType: z.enum(["Petrol", "Diesel", "Electric", "Hybrid"]).optional(),
    seats: z.number().optional(),
    pricePerDay: z.number().optional(),
    available: z.boolean().optional(),
    location: z.strictObject({
      city: z.string().optional(),
      address: z.string().optional(),
    }).optional(),
    image: z.string().optional(),
  }),
});
