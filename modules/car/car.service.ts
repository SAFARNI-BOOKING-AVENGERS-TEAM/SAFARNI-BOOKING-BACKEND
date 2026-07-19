import { Request, Response } from "express";
import CarModel from "../../DB/models/car.model";
import {
  BadRequestException,
  NotFoundException,
  UnAuthorizedException,
} from "../../utils/response/error.response";
import { successResponse } from "../../utils/response/success.response";

export const createCar = async (req: Request, res: Response) => {
  const userId = (req as any).credentials?.user?._id;
  if (!userId) {
    throw new UnAuthorizedException("Authentication credentials not found");
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
    createdBy: userId,
    updatedBy: userId,
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
  const userId = (req as any).credentials?.user?._id;
  if (!userId) {
    throw new UnAuthorizedException("Authentication credentials not found");
  }

  const { id } = req.params;
  const car = await CarModel.findById(id);

  if (!car) {
    throw new NotFoundException("Car not found");
  }

  const updateFields = req.body;
  Object.assign(car, updateFields);
  car.updatedBy = userId;

  await car.save();

  return successResponse({
    res,
    message: "Car updated successfully",
    data: car,
  });
};

export const deleteCar = async (req: Request, res: Response) => {
  const { id } = req.params;
  const car = await CarModel.findByIdAndDelete(id);

  if (!car) {
    throw new NotFoundException("Car not found");
  }

  return successResponse({
    res,
    message: "Car deleted successfully",
    data: car,
  });
};
