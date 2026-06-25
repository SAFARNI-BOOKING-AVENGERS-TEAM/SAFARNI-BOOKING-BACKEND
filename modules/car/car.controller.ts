import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../utils/response/async.handler";
import { validateRequest } from "../../middleware/requestValidation.middleware";
import {
  CreateCarSchema,
  UpdateCarSchema,
} from "./types/zod.types";
import {
  createCar,
  getCars,
  getCarById,
  updateCar,
  deleteCar,
} from "./car.service";

const carRouter = Router();

// Public: Retrieve cars list
carRouter.get("/", asyncHandler(getCars));

// Public: Retrieve a single car by ID
carRouter.get("/:id", asyncHandler(getCarById));

// Protected: Create a car listing
carRouter.post(
  "/createCar",
  authMiddleware,
  validateRequest(CreateCarSchema),
  asyncHandler(createCar)
);

// Protected: Update a car listing
carRouter.patch(
  "/updateCar/:id",
  authMiddleware,
  validateRequest(UpdateCarSchema),
  asyncHandler(updateCar)
);

// Protected: Delete a car listing
carRouter.delete(
  "/deleteCar/:id",
  authMiddleware,
  asyncHandler(deleteCar)
);

export default carRouter;
