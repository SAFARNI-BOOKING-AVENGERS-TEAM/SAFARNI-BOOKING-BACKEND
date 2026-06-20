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
    super(message, 402, cause);
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
    statusCode: number = 401,
    cause?: any
  ) {
    super(message, statusCode, cause);
  }
}

export class UnAuthorizedException extends ApplicationException {
  constructor(
    message: string = "You are not authorized. Please login to continue.",
    statusCode: number = 401,
    cause?: any
  ) {
    super(message, statusCode, cause);
  }
}

export class ForbiddenException extends ApplicationException {
  constructor(
    message: string = "You don't have permission to perform this action",
    statusCode: number = 403,
    cause?: any
  ) {
    super(message, statusCode, cause);
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
  error: ApplicationException,
  req: any,
  res: any,
  next: any
) => {
  res.status(error.statusCode || 500).json({
    error_message: error.message || "Something Went Wrong",
    name: error.name,
    statusCode: error.statusCode || 500,
    cause: error.cause,
    error_stack:
      process.env.NODE_ENV === "development" ? error.stack : undefined,
  });
};
