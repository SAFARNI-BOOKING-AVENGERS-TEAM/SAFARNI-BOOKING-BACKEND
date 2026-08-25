import { z } from "zod";

export const CreateHotelSchema = z.object({
  body: z.strictObject({
    name: z.string().min(2, "Hotel name is required"),
    description: z.string().optional(),
    rating: z.number().min(0).max(5).optional(),
    location: z.object({
      city: z.string().optional(),
      address: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
    }),
    amenities: z.array(z.string()).optional(),
    policies: z
      .object({
        checkIn: z.string().optional(),
        checkOut: z.string().optional(),
        cancellation: z.string().optional(),
      })
      .optional(),
  }),
});

export const CreateRoomSchema = z.object({
  params: z.object({
    hotelId: z.string().min(1, "Hotel ID is required"),
  }),
  body: z.strictObject({
    name: z.string().min(1, "Room name is required"),
    occupancy: z.object({
      adults: z.number().int().positive("Adults count must be a positive number"),
      children: z.number().int().min(0).optional(),
    }),
    pricePerNight: z.number().positive("Price per night must be a positive number"),
    refundable: z.boolean().optional(),
    amenities: z.array(z.string()).optional(),
  }),
});

export const UpdateRoomSchema = z.object({
  params: z.object({
    roomId: z.string().min(1, "Room ID is required"),
  }),
  body: CreateRoomSchema.shape.body.partial(),
});