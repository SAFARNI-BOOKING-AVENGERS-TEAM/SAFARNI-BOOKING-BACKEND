import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { adminMiddleware } from "../../middleware/admin.middleware";
import { authorizeRoles } from "../../middleware/admin.middleware";
import { asyncHandler } from "../../utils/response/async.handler";
import { validateRequest } from "../../middleware/requestValidation.middleware";
import { requireProviderType } from "../../middleware/providerType.middleware";
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
  updateFlightStatus,
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
  authorizeRoles("admin", "provider"),
  requireProviderType("travel", "both"),
  validateRequest(CreateFlightSchema),
  asyncHandler(createFlight)
);

// Protected: Update a flight listing
flightRouter.patch(
  "/updateFlight/:id",
  authMiddleware,
  authorizeRoles("admin", "provider"),
  validateRequest(UpdateFlightSchema),
  asyncHandler(updateFlight)
);

// Protected: Delete a flight listing
flightRouter.delete(
  "/deleteFlight/:id",
  authMiddleware,
  authorizeRoles("admin", "provider"),
  asyncHandler(deleteFlight)
);

flightRouter.patch(
  "/updateFlightStatus/:id",
  authMiddleware,
  authorizeRoles("admin"),
  asyncHandler(updateFlightStatus)
);

export default flightRouter;
