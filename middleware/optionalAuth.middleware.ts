import { Response, NextFunction } from "express";
import { IRequest } from "../types/request.types";
import { verifyToken, TokenType } from "../utils/security/token.security";

export const optionalAuthMiddleware = async (
  req: IRequest,
  _res: Response,
  next: NextFunction
) => {
  const token = req.cookies?.access_token;

  if (!token) {
    return next();
  }

  try {
    req.credentials = await verifyToken(token, TokenType.access);
  } catch (_err) {
    // Invalid/expired token: just treat as a guest, don't block the request
  }

  return next();
};
