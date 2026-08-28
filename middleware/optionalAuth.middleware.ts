import { Request, Response, NextFunction } from "express";
import { verifyToken, TokenType } from "../utils/security/token.security";

export const optionalAuthMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const token = req.cookies?.access_token;

  if (!token) {
    return next();
  }

  try {
    const { user } = await verifyToken(token, TokenType.access);
    (req as any).credentials = { user };
  } catch (_err) {
    // Invalid/expired token: just treat as a guest, don't block the request
  }

  return next();
};
