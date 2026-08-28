import BookingModel from "../../DB/models/booking.model";
import HotelModel from "../../DB/models/hotel.model";
import RoomModel from "../../DB/models/room.model";
import TourModel from "../../DB/models/tour.model";
import CarModel from "../../DB/models/car.model";
import FlightModel from "../../DB/models/flight.model";
import { BadRequestException, ForbiddenException, NotFoundException } from "../../utils/response/error.response";
import { sendNotification } from "../../utils/notifications/sendNotification";
import { refundBookingPayment } from "../payment/payment.service";

type ManagerActor =
  | { role: "admin"; _id?: string }
  | { role: "provider"; _id: string };

const getServiceOwnerId = async (category: string, itemId: string) => {
  if (category === "hotels") {
    const room = await RoomModel.findById(itemId);
    if (!room) throw new NotFoundException("Room not found");
    const hotel = await HotelModel.findById(room.hotelId);
    if (!hotel) throw new NotFoundException("Hotel not found");
    return hotel.createdBy?.toString();
  }

  if (category === "tours") {
    const tour = await TourModel.findById(itemId);
    if (!tour) throw new NotFoundException("Tour not found");
    return tour.createdBy?.toString();
  }

  if (category === "cars") {
    const car = await CarModel.findById(itemId);
    if (!car) throw new NotFoundException("Car not found");
    return car.createdBy?.toString();
  }

  if (category === "flights") {
    const flight = await FlightModel.findById(itemId);
    if (!flight) throw new NotFoundException("Flight not found");
    return flight.createdBy?.toString();
  }

  throw new BadRequestException("Invalid booking category");
};

export const cancelBookingAsManager = async (
  bookingId: string,
  actor: ManagerActor
) => {
  const booking = await BookingModel.findById(bookingId);
  if (!booking) throw new NotFoundException("Booking not found");
  if (booking.status === "cancelled") {
    throw new BadRequestException("Booking is already cancelled");
  }

  if (actor.role === "provider") {
    const ownerId = await getServiceOwnerId(booking.category, booking.itemId);
    if (!ownerId || ownerId !== actor._id.toString()) {
      throw new ForbiddenException("You can only cancel bookings for services you own");
    }
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
    refundIssued = Boolean(refund);
  } catch (error) {
    console.error("[refund] Managed booking cancellation requires refund follow-up", booking._id, error);
  }

  await sendNotification(booking.userId.toString(), {
    title: "Booking Cancelled",
    message: refundIssued
      ? `Your ${booking.category} booking was cancelled and its payment was refunded.`
      : `Your ${booking.category} booking was cancelled. Any applicable refund is being reconciled.`,
    type: "booking_status_changed",
    relatedId: booking._id.toString(),
  });

  return { booking, refundIssued };
};
