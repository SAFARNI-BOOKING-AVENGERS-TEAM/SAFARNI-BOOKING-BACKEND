import { IRequest } from "../types/request.types";
import { UnAuthorizedException } from "../utils/response/error.response";
import { verifyToken } from "../utils/security/token.security";
import { Response, NextFunction } from "express";

export const authMiddleware = async (
  req: IRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const accessToken = req.cookies?.access_token;

    if (!accessToken) {
      throw new UnAuthorizedException(
        "Unauthorized - Access token missing"
      );
    }

    req.credentials = await verifyToken(accessToken);

    next();
  } catch (error) {
    if (error instanceof UnAuthorizedException) {
      throw error;
    }

    throw new UnAuthorizedException(
      "Unauthorized - Invalid or expired token"
    );
  }
};