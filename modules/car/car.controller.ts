import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { adminMiddleware } from "../../middleware/admin.middleware";
import { authorizeRoles } from "../../middleware/admin.middleware";
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
  updateCarStatus,
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
  authorizeRoles("admin", "provider"),
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

// ADMIN APPROVE / REJECT CAR
carRouter.patch(
  "/admin/:id/status",
  authMiddleware,
  adminMiddleware,
  asyncHandler(updateCarStatus)
);

export default carRouter;
