import { Request, Response } from "express";
import BookingModel from "../../DB/models/booking.model";
import HotelModel from "../../DB/models/hotel.model";
import RoomModel from "../../DB/models/room.model";
import TourModel from "../../DB/models/tour.model";
import CarModel from "../../DB/models/car.model";
import FlightModel from "../../DB/models/flight.model";
import { sendNotification } from "../../utils/notifications/sendNotification";
import {
  BadRequestException,
  NotFoundException,
  UnAuthorizedException,
  ForbiddenException,
} from "../../utils/response/error.response";
import { refundBookingPayment } from "../payment/payment.service";
import { successResponse } from "../../utils/response/success.response";

// INTERNAL: books a single item (used directly by createBooking,
// and 4x in a row by createPackageBooking). Throws on any failure —
// the caller decides what to do (reject the whole request, or roll back).
interface SingleBookingInput {
  userId: string;
  category: "hotels" | "tours" | "flights" | "cars";
  itemId: string;
  startDate: Date;
  endDate: Date;
  details?: any;
  discountMultiplier?: number; // e.g. 0.85 for a 15% package discount
  packageBookingId?: string;
}

export const createSingleBooking = async ({
  userId,
  category,
  itemId,
  startDate: start,
  endDate: end,
  details,
  discountMultiplier = 1,
  packageBookingId,
}: SingleBookingInput) => {
  // Prevent a user from booking overlapping Car and Flight reservations
  // (mutually exclusive: can't be driving and flying at the same time)
  if (category === "cars" || category === "flights") {
    const conflictingBooking = await BookingModel.findOne({
      userId,
      category: { $in: ["cars", "flights"] },
      status: { $ne: "cancelled" },
      startDate: { $lt: end },
      endDate: { $gt: start },
    });

    if (conflictingBooking) {
      throw new BadRequestException(
        `You already have a ${conflictingBooking.category} booking that overlaps with this time. Please check your schedule.`
      );
    }
  }

  let totalPrice = 0;
  const quantity = Number(details?.guests || details?.quantity || 1);
  let ownerId: string | null = null;

  if (category === "hotels") {
    // itemId is Room ID
    const room = await RoomModel.findById(itemId);
    if (!room) {
      throw new NotFoundException("Room not found");
    }

    const overlappingBooking = await BookingModel.findOne({
      category: "hotels",
      itemId,
      status: { $ne: "cancelled" },
      startDate: { $lt: end },
      endDate: { $gt: start },
    });

    if (overlappingBooking) {
      throw new BadRequestException(
        "This room is already booked for the selected dates"
      );
    }

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const nights = diffDays > 0 ? diffDays : 1;

    totalPrice = room.pricePerNight * nights;

    const hotel = await HotelModel.findById(room.hotelId);
    ownerId = hotel?.createdBy?.toString() || null;
  } else if (category === "tours") {
    const tour = await TourModel.findById(itemId);
    if (!tour) {
      throw new NotFoundException("Tour not found");
    }

    const matchedStartDate = tour.startDates?.find(
      (sd) => new Date(sd.date).toDateString() === start.toDateString()
    );

    if (!matchedStartDate) {
      throw new BadRequestException(
        "This tour is not available on the selected start date"
      );
    }

    const existingBookings = await BookingModel.find({
      category: "tours",
      itemId,
      status: { $ne: "cancelled" },
      startDate: start,
    });

    const alreadyBooked = existingBookings.reduce(
      (sum, b) => sum + Number(b.details?.guests || b.details?.quantity || 1),
      0
    );

    if (alreadyBooked + quantity > matchedStartDate.capacity) {
      throw new BadRequestException(
        `Only ${Math.max(matchedStartDate.capacity - alreadyBooked, 0)} spot(s) left for this date`
      );
    }

    const selectedTier = details?.priceTier || "Standard";
    const priceTier = tour.priceTiers.find(
      (t) => t.type.toLowerCase() === selectedTier.toLowerCase()
    );
    const unitPrice = priceTier ? priceTier.price : (tour.priceTiers[0]?.price || 100);

    totalPrice = unitPrice * quantity;
    ownerId = tour.createdBy?.toString() || null;
  } else if (category === "flights") {
    const flight = await FlightModel.findById(itemId);
    if (!flight) {
      throw new NotFoundException("Flight not found");
    }
    if (flight.availableSeats < quantity) {
      throw new BadRequestException("Not enough seats available");
    }
    totalPrice = flight.price * quantity;
    flight.availableSeats -= quantity;
    await flight.save();
    ownerId = flight.createdBy?.toString() || null;
  } else if (category === "cars") {
    const car = await CarModel.findById(itemId);
    if (!car) {
      throw new NotFoundException("Car not found");
    }
    if (!car.available) {
      throw new BadRequestException("Car is not available for rental");
    }

    const overlappingBooking = await BookingModel.findOne({
      category: "cars",
      itemId,
      status: { $ne: "cancelled" },
      startDate: { $lt: end },
      endDate: { $gt: start },
    });

    if (overlappingBooking) {
      throw new BadRequestException(
        "This car is already booked for the selected dates"
      );
    }

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const days = diffDays > 0 ? diffDays : 1;

    totalPrice = car.pricePerDay * days;
    ownerId = car.createdBy?.toString() || null;
  } else {
    throw new BadRequestException("Invalid booking category");
  }

  totalPrice = Math.round(totalPrice * discountMultiplier * 100) / 100;

  const booking = await BookingModel.create({
    userId,
    category,
    itemId,
    startDate: start,
    endDate: end,
    totalPrice,
    status: "pending",
    details: details || {},
    ...(packageBookingId && { packageBookingId }),
  });

  if (ownerId) {
    await sendNotification(ownerId, {
      title: "New Booking Received",
      message: `You have received a new ${category} booking.`,
      type: "booking_created",
      relatedId: booking._id.toString(),
    });
  }

  return booking;
};

// Soft-rollback helper: cancels a booking we created earlier in the same
// request, restoring flight seats if needed — used when a later item in a
// package booking fails and we need to undo the ones that already succeeded.
const rollbackBooking = async (bookingId: string) => {
  const booking = await BookingModel.findById(bookingId);
  if (!booking || booking.status === "cancelled") return;

  if (booking.category === "flights") {
    const flight = await FlightModel.findById(booking.itemId);
    if (flight) {
      const qty = Number(booking.details?.guests || booking.details?.quantity || 1);
      flight.availableSeats += qty;
      await flight.save();
    }
  }

  booking.status = "cancelled";
  await booking.save();
};

// PUBLIC: single-item booking endpoint (unchanged behavior)
export const createBooking = async (req: Request, res: Response) => {
  const userId = (req as any).credentials?.user?._id;
  if (!userId) {
    throw new UnAuthorizedException("Authentication credentials not found");
  }

  const { category, itemId, startDate, endDate, details } = req.body;

  const booking = await createSingleBooking({
    userId,
    category,
    itemId,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    details,
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

  if (booking.userId.toString() !== userId.toString()) {
    throw new UnAuthorizedException("You are not authorized to cancel this booking");
  }

  if (booking.status === "cancelled") {
    throw new BadRequestException("Booking is already cancelled");
  }

  if (booking.category === "flights") {
    const flight = await FlightModel.findById(booking.itemId);
    if (flight) {
      const quantity = Number(booking.details?.guests || booking.details?.quantity || 1);
      flight.availableSeats += quantity;
      await flight.save();
    }
  }

booking.status = "cancelled";
  await booking.save();

  let refundIssued = false;
  try {
    const refund = await refundBookingPayment(
      booking._id.toString(),
      booking.packageBookingId,
      booking.totalPrice
    );
    refundIssued = !!refund;
  } catch (err) {
    console.error("[refund] Failed to process refund for booking", booking._id, err);
    // Don't block the cancellation itself if the refund call fails —
    // the booking is still cancelled; the refund can be retried/handled manually.
  }

  return successResponse({
    res,
    message: refundIssued
      ? "Booking cancelled and payment refunded successfully"
      : "Booking cancelled successfully",
    data: booking,
  });
};

export const updateBookingStatus = async (req: Request, res: Response) => {
  const { bookingId } = req.params;
  const { status } = req.body;

  const user = (req as any).credentials?.user;

  if (!user) {
    throw new UnAuthorizedException("Authentication credentials not found");
  }

  const booking = await BookingModel.findById(bookingId);

  if (!booking) {
    throw new NotFoundException("Booking not found");
  }

  if (user.role === "provider") {
    let serviceOwnerId: any = null;

    switch (booking.category) {
      case "hotels": {
        const room = await RoomModel.findById(booking.itemId);
        if (!room) throw new NotFoundException("Room not found");
        const hotel = await HotelModel.findById(room.hotelId);
        if (!hotel) throw new NotFoundException("Hotel not found");
        serviceOwnerId = hotel.createdBy;
        break;
      }
      case "tours": {
        const tour = await TourModel.findById(booking.itemId);
        if (!tour) throw new NotFoundException("Tour not found");
        serviceOwnerId = tour.createdBy;
        break;
      }
      case "cars": {
        const car = await CarModel.findById(booking.itemId);
        if (!car) throw new NotFoundException("Car not found");
        serviceOwnerId = car.createdBy;
        break;
      }
      case "flights": {
        const flight = await FlightModel.findById(booking.itemId);
        if (!flight) throw new NotFoundException("Flight not found");
        serviceOwnerId = flight.createdBy;
        break;
      }
      default:
        throw new BadRequestException("Invalid booking category");
    }

    if (serviceOwnerId.toString() !== user._id.toString()) {
      throw new ForbiddenException("You can only update bookings for services you own");
    }
  }

  booking.status = status;
  await booking.save();

  await sendNotification(booking.userId.toString(), {
    title: "Booking Status Updated",
    message: `Your ${booking.category} booking status changed to "${status}".`,
    type: "booking_status_changed",
    relatedId: booking._id.toString(),
  });

  return successResponse({
    res,
    message: "Booking status updated successfully",
    data: booking,
  });
};

// =========================================================
// PACKAGE BOOKING: books every item in a package back-to-back,
// applying the package discount. All-or-nothing: if any item fails,
// everything booked so far in this same request is rolled back.
// =========================================================
export const createPackageBookingInternal = async (
  userId: string,
  items: { category: "hotels" | "tours" | "flights" | "cars"; itemId: string; startDate: string; endDate: string; details?: any }[],
  discountPercentage: number
) => {
  const discountMultiplier = 1 - discountPercentage / 100;
  const packageBookingId = `pkg_${Date.now()}_${userId}`;
  const createdBookingIds: string[] = [];

  try {
    for (const item of items) {
      const booking = await createSingleBooking({
        userId,
        category: item.category,
        itemId: item.itemId,
        startDate: new Date(item.startDate),
        endDate: new Date(item.endDate),
        details: item.details,
        discountMultiplier,
        packageBookingId,
      });
      createdBookingIds.push(booking._id.toString());
    }
  } catch (err) {
    // Roll back anything we already booked in this attempt
    for (const id of createdBookingIds) {
      await rollbackBooking(id);
    }
    throw err;
  }

  const bookings = await BookingModel.find({ _id: { $in: createdBookingIds } });
  return { packageBookingId, bookings };
};

export const getBookingsByCategory = async () => {
  return await BookingModel.aggregate([
    { $group: { _id: "$category", totalBookings: { $sum: 1 } } },
    { $sort: { totalBookings: -1 } },
  ]);
};

export const getRevenueByCategory = async () => {
  return await BookingModel.aggregate([
    { $match: { status: { $ne: "cancelled" } } },
    { $group: { _id: "$category", totalRevenue: { $sum: "$totalPrice" }, totalBookings: { $sum: 1 } } },
    { $sort: { totalRevenue: -1 } },
  ]);
};

export const getBookingsByStatus = async () => {
  return await BookingModel.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
};