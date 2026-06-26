import { z } from "zod";

export const CreateFlightSchema = z.object({
  body: z.strictObject({
    airline: z.string({ message: "Airline is required" }).min(1, "Airline cannot be empty"),
    flightNumber: z.string({ message: "Flight number is required" }).min(1, "Flight number cannot be empty"),
    departureAirport: z
      .string({ message: "Departure airport is required" })
      .min(3, "Departure airport code must be 3 characters")
      .max(3, "Departure airport code must be 3 characters"),
    arrivalAirport: z
      .string({ message: "Arrival airport is required" })
      .min(3, "Arrival airport code must be 3 characters")
      .max(3, "Arrival airport code must be 3 characters"),
    departureTime: z.string({ message: "Departure time is required" }).refine((val) => !isNaN(Date.parse(val)), {
      message: "Departure time must be a valid date string",
    }),
    arrivalTime: z.string({ message: "Arrival time is required" }).refine((val) => !isNaN(Date.parse(val)), {
      message: "Arrival time must be a valid date string",
    }),
    price: z.number({ message: "Price is required" }).min(0, "Price must be non-negative"),
    availableSeats: z.number({ message: "Available seats count is required" }).min(0, "Seats must be non-negative"),
    class: z.enum(["Economy", "Business", "First"]).optional(),
  }),
});

export const UpdateFlightSchema = z.object({
  body: z.strictObject({
    airline: z.string().optional(),
    flightNumber: z.string().optional(),
    departureAirport: z.string().min(3).max(3).optional(),
    arrivalAirport: z.string().min(3).max(3).optional(),
    departureTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: "Departure time must be a valid date string",
    }).optional(),
    arrivalTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: "Arrival time must be a valid date string",
    }).optional(),
    price: z.number().min(0).optional(),
    availableSeats: z.number().min(0).optional(),
    class: z.enum(["Economy", "Business", "First"]).optional(),
  }),
});
