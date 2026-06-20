import { Request, Response, NextFunction } from "express";
import { BadRequestException } from "../utils/response/error.response";
import { ZodObject } from "zod";

export const validateRequest = (schema: ZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const result = await schema.safeParseAsync({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      const formattedMessage = result.error.issues
        .map((issue) => {
          const field = issue.path[issue.path.length - 1];
          return `${field.toString()}: ${issue.message}`;
        })
        .join(", ");

      return next(new BadRequestException(formattedMessage));
    }

    return next();
  };
};
