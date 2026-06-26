import { Request, Response } from "express";
import FlightModel from "../../DB/models/flight.model";
import {
  BadRequestException,
  NotFoundException,
  UnAuthorizedException,
} from "../../utils/response/error.response";
import { successResponse } from "../../utils/response/success.response";

export const createFlight = async (req: Request, res: Response) => {
  const userId = (req as any).credentials?.user?._id;
  if (!userId) {
    throw new UnAuthorizedException("Authentication credentials not found");
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
    createdBy: userId,
    updatedBy: userId,
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
  const userId = (req as any).credentials?.user?._id;
  if (!userId) {
    throw new UnAuthorizedException("Authentication credentials not found");
  }

  const { id } = req.params;
  const flight = await FlightModel.findById(id);

  if (!flight) {
    throw new NotFoundException("Flight not found");
  }

  const updateFields = req.body;
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
  flight.updatedBy = userId;

  await flight.save();

  return successResponse({
    res,
    message: "Flight updated successfully",
    data: flight,
  });
};

export const deleteFlight = async (req: Request, res: Response) => {
  const { id } = req.params;
  const flight = await FlightModel.findByIdAndDelete(id);

  if (!flight) {
    throw new NotFoundException("Flight not found");
  }

  return successResponse({
    res,
    message: "Flight deleted successfully",
    data: flight,
  });
};
