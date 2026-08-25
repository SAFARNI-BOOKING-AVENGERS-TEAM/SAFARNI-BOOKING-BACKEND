import { Request, Response, NextFunction } from "express";

export class ApplicationException extends Error {
  statusCode: number;
  cause?: any;

  constructor(message: string, statusCode: number = 400, cause?: any) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.cause = cause;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestException extends ApplicationException {
  constructor(message: string, cause?: any) {
    super(message, 400, cause);
  }
}

export class ValidationException extends ApplicationException {
  constructor(message: string, cause?: any) {
    super(message, 400, cause);
  }
}

export class ConflictException extends ApplicationException {
  constructor(message: string, cause?: any) {
    super(message, 409, cause);
  }
}

export class NotFoundException extends ApplicationException {
  constructor(message: string = "Not Found", cause?: any) {
    super(message, 404, cause);
  }
}

export class InvalidTokenException extends ApplicationException {
  constructor(
    message: string = "The token is invalid or has expired",
    cause?: any
  ) {
    super(message, 401, cause);
  }
}

export class UnAuthorizedException extends ApplicationException {
  constructor(
    message: string = "You are not authorized. Please login to continue.",
    cause?: any
  ) {
    super(message, 401, cause);
  }
}

export class ForbiddenException extends ApplicationException {
  constructor(
    message: string = "You don't have permission to perform this action",
    cause?: any
  ) {
    super(message, 403, cause);
  }
}

export class TooManyRequestsException extends ApplicationException {
  constructor(
    message: string = "Too many requests. Please try again later.",
    cause?: any
  ) {
    super(message, 429, cause);
  }
}

export const globalErrorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = error.statusCode || 500;

  return res.status(statusCode).json({
    success: false,
    message: error.message || "Internal Server Error",
    statusCode,

    cause:
      process.env.NODE_ENV === "development"
        ? error.cause
        : undefined,

    stack:
      process.env.NODE_ENV === "development"
        ? error.stack
        : undefined,
  });
};