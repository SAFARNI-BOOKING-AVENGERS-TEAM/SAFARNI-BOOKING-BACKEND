import { IRequest } from "./../types/request.types";
import { ForbiddenException } from "./../utils/response/error.response";
import { Response, NextFunction } from "express";

export const authorizeRoles = (...allowedRoles: string[]) => {
  return (req: IRequest, res: Response, next: NextFunction) => {
    const role = req.credentials?.user?.role;

    if (!role || !allowedRoles.includes(role)) {
      throw new ForbiddenException(
        `Access denied - requires one of the following roles: ${allowedRoles.join(", ")}`
      );
    }

    next();
  };
};

// Backward-compatible: every existing route already imports "adminMiddleware".
// Keeping this alias means we don't have to touch Tours/Hotels/Cars/Flights/Booking at all.
export const adminMiddleware = authorizeRoles("admin");