import { Response, NextFunction } from "express";
import { IRequest } from "./../types/request.types";
import { ForbiddenException } from "./../utils/response/error.response";

export const requireProviderType = (...allowedTypes: string[]) => {
  return (req: IRequest, res: Response, next: NextFunction) => {
    const user = req.credentials?.user;

    // Admin bypasses provider-type restrictions entirely
    if (user?.role === "admin") {
      return next();
    }

    if (user?.role === "provider" && user.providerType && allowedTypes.includes(user.providerType)) {
      return next();
    }

    throw new ForbiddenException(
      `This action requires a provider account of type: ${allowedTypes.join(" or ")}`
    );
  };
};