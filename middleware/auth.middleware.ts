import { IRequest } from './../types/request.types';
import { ForbiddenException } from "./../utils/response/error.response";
import { verifyToken } from "./../utils/security/token.security";
import {  Response, NextFunction } from "express";

export const authMiddleware = async (
  req: IRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const accessToken = req.cookies?.access_token;

    if (!accessToken) {
      return res.status(401).json({
        message: "Unauthorized - Access token missing",
      });
    }

    req.credentials =await verifyToken(accessToken);

    next();
  } catch (error) {
    throw new ForbiddenException("Unauthorized - Invalid or expired token");
  }
};