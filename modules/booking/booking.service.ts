import { Request, Response } from "express";
import BookingModel from "../../DB/models/booking.model";
import RoomModel from "../../DB/models/room.model";
import TourModel from "../../DB/models/tour.model";
import CarModel from "../../DB/models/car.model";
import {
  BadRequestException,
  NotFoundException,
  UnAuthorizedException,
} from "../../utils/response/error.response";
import { successResponse } from "../../utils/response/success.response";

export const createBooking = async (req: Request, res: Response) => {
  const userId = (req as any).credentials?.user?._id;
  if (!userId) {
    throw new UnAuthorizedException("Authentication credentials not found");
  }

  const { category, itemId, startDate, endDate, details } = req.body;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end.getTime() <= start.getTime()) {
    throw new BadRequestException("End date must be after start date");
  }

  let totalPrice = 0;
  const quantity = Number(details?.guests || details?.quantity || 1);

  if (category === "hotels") {
    // itemId is Room ID
    const room = await RoomModel.findById(itemId);
    if (!room) {
      throw new NotFoundException("Room not found");
    }

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const nights = diffDays > 0 ? diffDays : 1;

    totalPrice = room.pricePerNight * nights;
  } else if (category === "tours") {
    // itemId is Tour ID
    const tour = await TourModel.findById(itemId);
    if (!tour) {
      throw new NotFoundException("Tour not found");
    }

    const selectedTier = details?.priceTier || "Standard";
    const priceTier = tour.priceTiers.find(
      (t) => t.type.toLowerCase() === selectedTier.toLowerCase()
    );
    const unitPrice = priceTier ? priceTier.price : (tour.priceTiers[0]?.price || 100);

    totalPrice = unitPrice * quantity;
  } else if (category === "flights") {
    const flightPrice = Number(details?.price || 300);
    totalPrice = flightPrice * quantity;
  } else if (category === "cars") {
    // itemId is Car ID
    const car = await CarModel.findById(itemId);
    if (!car) {
      throw new NotFoundException("Car not found");
    }
    if (!car.available) {
      throw new BadRequestException("Car is not available for rental");
    }

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const days = diffDays > 0 ? diffDays : 1;

    totalPrice = car.pricePerDay * days;
  } else {
    throw new BadRequestException("Invalid booking category");
  }

  const booking = await BookingModel.create({
    userId,
    category,
    itemId,
    startDate: start,
    endDate: end,
    totalPrice,
    status: "pending",
    details: details || {},
  });

  return successResponse({
    res,
    statusCode: 201,
    message: "Booking created successfully",
    data: booking,
  });
};

export const getMyBookings = async (req: Request, res: Response) => {
  const userId = (req as any).credentials?.user?._id;
  if (!userId) {
    throw new UnAuthorizedException("Authentication credentials not found");
  }

  const bookings = await BookingModel.find({ userId });

  return successResponse({
    res,
    message: "Bookings retrieved successfully",
    data: bookings,
  });
};

export const getBookingDetails = async (req: Request, res: Response) => {
  const userId = (req as any).credentials?.user?._id;
  if (!userId) {
    throw new UnAuthorizedException("Authentication credentials not found");
  }

  const { bookingId } = req.params;
  const booking = await BookingModel.findById(bookingId);

  if (!booking) {
    throw new NotFoundException("Booking not found");
  }

  // Verify ownership
  if (booking.userId.toString() !== userId.toString()) {
    throw new UnAuthorizedException("You are not authorized to view this booking");
  }

  return successResponse({
    res,
    message: "Booking details retrieved successfully",
    data: booking,
  });
};

export const cancelBooking = async (req: Request, res: Response) => {
  const userId = (req as any).credentials?.user?._id;
  if (!userId) {
    throw new UnAuthorizedException("Authentication credentials not found");
  }

  const { bookingId } = req.params;
  const booking = await BookingModel.findById(bookingId);

  if (!booking) {
    throw new NotFoundException("Booking not found");
  }

  // Verify ownership
  if (booking.userId.toString() !== userId.toString()) {
    throw new UnAuthorizedException("You are not authorized to cancel this booking");
  }

  if (booking.status === "cancelled") {
    throw new BadRequestException("Booking is already cancelled");
  }

  booking.status = "cancelled";
  await booking.save();

  return successResponse({
    res,
    message: "Booking cancelled successfully",
    data: booking,
  });
};

export const updateBookingStatus = async (req: Request, res: Response) => {
  const { bookingId } = req.params;
  const { status } = req.body;

  const booking = await BookingModel.findById(bookingId);

  if (!booking) {
    throw new NotFoundException("Booking not found");
  }

  booking.status = status;
  await booking.save();

  return successResponse({
    res,
    message: "Booking status updated successfully",
    data: booking,
  });
};
