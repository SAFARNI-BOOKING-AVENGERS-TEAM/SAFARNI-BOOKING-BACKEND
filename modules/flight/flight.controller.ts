import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../utils/response/async.handler";
import { validateRequest } from "../../middleware/requestValidation.middleware";
import {
  CreateFlightSchema,
  UpdateFlightSchema,
} from "./types/zod.types";
import {
  createFlight,
  getFlights,
  getFlightById,
  updateFlight,
  deleteFlight,
} from "./flight.service";

const flightRouter = Router();

// Public: Retrieve flights list
flightRouter.get("/", asyncHandler(getFlights));

// Public: Retrieve a single flight by ID
flightRouter.get("/:id", asyncHandler(getFlightById));

// Protected: Create a flight listing
flightRouter.post(
  "/createFlight",
  authMiddleware,
  validateRequest(CreateFlightSchema),
  asyncHandler(createFlight)
);

// Protected: Update a flight listing
flightRouter.patch(
  "/updateFlight/:id",
  authMiddleware,
  validateRequest(UpdateFlightSchema),
  asyncHandler(updateFlight)
);

// Protected: Delete a flight listing
flightRouter.delete(
  "/deleteFlight/:id",
  authMiddleware,
  asyncHandler(deleteFlight)
);

export default flightRouter;
