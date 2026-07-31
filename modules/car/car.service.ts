import { Request, Response } from "express";
import CarModel from "../../DB/models/car.model";
import { sendNotification } from "../../utils/notifications/sendNotification";
import BookingModel from "../../DB/models/booking.model";
import {
  BadRequestException,
  NotFoundException,
  UnAuthorizedException,
  ForbiddenException,
} from "../../utils/response/error.response";
import { successResponse } from "../../utils/response/success.response";

export const createCar = async (req: Request, res: Response) => {
  const user = (req as any).credentials?.user;

  if (!user?._id) {
    throw new UnAuthorizedException(
      "Authentication credentials not found"
    );
  }

  const {
    brand,
    model,
    year,
    type,
    transmission,
   
    seats,
    pricePerDay,
    available,
    location,
    image,
  } = req.body;

  const car = await CarModel.create({
    brand,
    model,
    year,
    type,
    transmission,
   
    seats,
    pricePerDay,
    available,
    location,
    image,

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
    message: "Car rental created successfully",
    data: car,
  });
};

export const getCars = async (req: Request, res: Response) => {
  const { city, type, available } = req.query;

  const query: any = {};
  if (city) {
    query["location.city"] = { $regex: city as string, $options: "i" };
  }
  if (type) {
    query.type = type;
  }
  if (available !== undefined) {
    query.available = available === "true";
  }

  const cars = await CarModel.find(query);

  return successResponse({
    res,
    message: "Cars retrieved successfully",
    data: cars,
  });
};

export const getCarById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const car = await CarModel.findById(id);

  if (!car) {
    throw new NotFoundException("Car not found");
  }

  return successResponse({
    res,
    message: "Car retrieved successfully",
    data: car,
  });
};

export const updateCar = async (req: Request, res: Response) => {
  const user = (req as any).credentials?.user;

  if (!user?._id) {
    throw new UnAuthorizedException(
      "Authentication credentials not found"
    );
  }

  const { id } = req.params;

  const car = await CarModel.findById(id);

  if (!car) {
    throw new NotFoundException("Car not found");
  }

  if (
    user.role !== "admin" &&
    car.createdBy.toString() !== user._id.toString()
  ) {
    throw new ForbiddenException(
      "You can only update cars you own"
    );
  }

  const updateFields = req.body;

  Object.assign(car, updateFields);

  car.updatedBy = user._id;

  await car.save();

  return successResponse({
    res,
    message: "Car updated successfully",
    data: car,
  });
};

export const deleteCar = async (req: Request, res: Response) => {
  const user = (req as any).credentials?.user;

  if (!user?._id) {
    throw new UnAuthorizedException(
      "Authentication credentials not found"
    );
  }

  const { id } = req.params;

  const car = await CarModel.findById(id);

  if (!car) {
    throw new NotFoundException("Car not found");
  }

  // Admin can delete any car
  // Provider can delete only cars they own
  if (
    user.role !== "admin" &&
    car.createdBy.toString() !== user._id.toString()
  ) {
    throw new ForbiddenException(
      "You can only delete cars you own"
    );
  }

  const activeBooking = await BookingModel.findOne({
    category: "cars",
    itemId: id,
    status: { $ne: "cancelled" },
  });

  if (activeBooking) {
    throw new BadRequestException(
      "Cannot delete this car because it has active bookings"
    );
  }

  await CarModel.findByIdAndDelete(id);

  return successResponse({
    res,
    message: "Car deleted successfully",
    data: car,
  });
};

export const updateCarStatus = async (
  req: Request,
  res: Response
) => {
  const { id } = req.params;
  const { status } = req.body;

  if (
    status !== "approved" &&
    status !== "rejected"
  ) {
    throw new BadRequestException(
      "Status must be approved or rejected"
    );
  }

  const user = (req as any).credentials?.user;

  if (!user?._id) {
    throw new UnAuthorizedException(
      "Authentication credentials not found"
    );
  }

  const car = await CarModel.findById(id);

  if (!car) {
    throw new NotFoundException("Car not found");
  }

car.status = status;
  car.updatedBy = user._id;

  await car.save();

  await sendNotification(car.createdBy.toString(), {
    title: status === "approved" ? "Car Approved" : "Car Rejected",
    message:
      status === "approved"
        ? `Your car "${car.brand} ${car.model}" has been approved and is now live.`
        : `Your car "${car.brand} ${car.model}" was rejected. Please review and update it.`,
    type: status === "approved" ? "service_approved" : "service_rejected",
    relatedId: car._id.toString(),
  });

  return successResponse({
    res,
    message: `Car ${status} successfully`,
    data: car,
  });
};