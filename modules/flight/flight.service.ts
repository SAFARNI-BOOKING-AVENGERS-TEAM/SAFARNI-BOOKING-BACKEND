import { Request, Response } from "express";
import FlightModel from "../../DB/models/flight.model";
import BookingModel from "../../DB/models/booking.model";
import { sendNotification } from "../../utils/notifications/sendNotification";
import {
  BadRequestException,
  NotFoundException,
  UnAuthorizedException,
  ConflictException,
  ForbiddenException,
} from "../../utils/response/error.response";
import { successResponse } from "../../utils/response/success.response";

export const createFlight = async (req: Request, res: Response) => {
  const user = (req as any).credentials?.user;

  if (!user?._id) {
    throw new UnAuthorizedException(
      "Authentication credentials not found"
    );
  }

  const {
    airline,
    flightNumber,
    departureAirport,
    arrivalAirport,
    departureTime,
    arrivalTime,
    price,
    availableSeats,
    class: flightClass,
  } = req.body;

  const depTime = new Date(departureTime);
  const arrTime = new Date(arrivalTime);

  if (arrTime.getTime() <= depTime.getTime()) {
    throw new BadRequestException("Arrival time must be after departure time");
  }

  const existingFlight = await FlightModel.findOne({ flightNumber });
  if (existingFlight) {
    throw new ConflictException(
      `A flight with number "${flightNumber}" already exists`
    );
  }

  const flight = await FlightModel.create({
    airline,
    flightNumber,
    departureAirport,
    arrivalAirport,
    departureTime: depTime,
    arrivalTime: arrTime,
    price,
    availableSeats,
    class: flightClass || "Economy",

    // Ownership
    createdBy: user._id,
    updatedBy: user._id,

    // Admin -> approved
    // Provider -> pending
    status:
      user.role === "admin"
        ? "approved"
        : "pending",
  });

  return successResponse({
    res,
    statusCode: 201,
    message: "Flight created successfully",
    data: flight,
  });
};

export const getFlights = async (req: Request, res: Response) => {
  const { departureAirport, arrivalAirport, date, class: flightClass } = req.query;

  const query: any = {};

  if (departureAirport) {
    query.departureAirport = (departureAirport as string).toUpperCase();
  }
  if (arrivalAirport) {
    query.arrivalAirport = (arrivalAirport as string).toUpperCase();
  }
  if (flightClass) {
    query.class = flightClass;
  }
  if (date) {
    const searchDate = new Date(date as string);
    if (!isNaN(searchDate.getTime())) {
      const startOfDay = new Date(searchDate);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(searchDate);
      endOfDay.setUTCHours(23, 59, 59, 999);
      query.departureTime = { $gte: startOfDay, $lte: endOfDay };
    }
  }

  const flights = await FlightModel.find(query);

  return successResponse({
    res,
    message: "Flights retrieved successfully",
    data: flights,
  });
};

export const getFlightById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const flight = await FlightModel.findById(id);

  if (!flight) {
    throw new NotFoundException("Flight not found");
  }

  return successResponse({
    res,
    message: "Flight retrieved successfully",
    data: flight,
  });
};

export const updateFlight = async (req: Request, res: Response) => {
  const user = (req as any).credentials?.user;

  if (!user?._id) {
    throw new UnAuthorizedException(
      "Authentication credentials not found"
    );
  }

  const { id } = req.params;
  const flight = await FlightModel.findById(id);

  if (!flight) {
    throw new NotFoundException("Flight not found");
  }
  if (
    user.role !== "admin" &&
    flight.createdBy.toString() !== user._id.toString()
  ) {
    throw new ForbiddenException(
      "You can only update flights you own"
    );
  }
  const updateFields = req.body;

  if (
    updateFields.flightNumber &&
    updateFields.flightNumber !== flight.flightNumber
  ) {
    const existingFlight = await FlightModel.findOne({
      flightNumber: updateFields.flightNumber,
    });
    if (existingFlight) {
      throw new ConflictException(
        `A flight with number "${updateFields.flightNumber}" already exists`
      );
    }
  }

  if (updateFields.departureTime) {
    updateFields.departureTime = new Date(updateFields.departureTime);
  }
  if (updateFields.arrivalTime) {
    updateFields.arrivalTime = new Date(updateFields.arrivalTime);
  }

  if (updateFields.departureTime && updateFields.arrivalTime) {
    if (updateFields.arrivalTime.getTime() <= updateFields.departureTime.getTime()) {
      throw new BadRequestException("Arrival time must be after departure time");
    }
  } else if (updateFields.departureTime) {
    if (flight.arrivalTime.getTime() <= updateFields.departureTime.getTime()) {
      throw new BadRequestException("Arrival time must be after departure time");
    }
  } else if (updateFields.arrivalTime) {
    if (updateFields.arrivalTime.getTime() <= flight.departureTime.getTime()) {
      throw new BadRequestException("Arrival time must be after departure time");
    }
  }

  Object.assign(flight, updateFields);
  flight.updatedBy = user._id;

  await flight.save();

  return successResponse({
    res,
    message: "Flight updated successfully",
    data: flight,
  });
};

export const deleteFlight = async (req: Request, res: Response) => {
  const user = (req as any).credentials?.user;

  if (!user?._id) {
    throw new UnAuthorizedException(
      "Authentication credentials not found"
    );
  }

  const { id } = req.params;

  const flight = await FlightModel.findById(id);

  if (!flight) {
    throw new NotFoundException("Flight not found");
  }

  if (
    user.role !== "admin" &&
    flight.createdBy.toString() !== user._id.toString()
  ) {
    throw new ForbiddenException(
      "You can only delete flights you own"
    );
  }

  const activeBooking = await BookingModel.findOne({
    category: "flights",
    itemId: id,
    status: { $ne: "cancelled" },
  });

  if (activeBooking) {
    throw new BadRequestException(
      "Cannot delete this flight because it has active bookings"
    );
  }

  await FlightModel.findByIdAndDelete(id);

  return successResponse({
    res,
    message: "Flight deleted successfully",
    data: flight,
  });
};

export const updateFlightStatus = async (
  req: Request,
  res: Response
) => {
  const { id } = req.params;
  const { status } = req.body;

  if (status !== "approved" && status !== "rejected") {
    throw new BadRequestException(
      "Status must be approved or rejected"
    );
  }

  const flight = await FlightModel.findById(id);

  if (!flight) {
    throw new NotFoundException("Flight not found");
  }

flight.status = status;

  const adminId = (req as any).credentials?.user?._id;
  flight.updatedBy = adminId;

  await flight.save();

  await sendNotification(flight.createdBy.toString(), {
    title: status === "approved" ? "Flight Approved" : "Flight Rejected",
    message:
      status === "approved"
        ? `Your flight "${flight.flightNumber}" has been approved and is now live.`
        : `Your flight "${flight.flightNumber}" was rejected. Please review and update it.`,
    type: status === "approved" ? "service_approved" : "service_rejected",
    relatedId: flight._id.toString(),
  });

  return successResponse({
    res,
    message: `Flight ${status} successfully`,
    data: flight,
  });
};