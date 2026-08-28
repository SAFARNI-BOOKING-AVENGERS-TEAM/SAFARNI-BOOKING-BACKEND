import { Request, Response, NextFunction } from "express";
import { BadRequestException } from "../utils/response/error.response";
import { z } from "zod";

export const validateRequest = (schema: z.ZodType) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const result = await schema.safeParseAsync({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      const formattedMessage = result.error.issues
        .map((issue) => {
          const field = issue.path[issue.path.length - 1] ?? "request";
          return `${String(field)}: ${issue.message}`;
        })
        .join(", ");

      return next(new BadRequestException(formattedMessage));
    }

    const parsed = result.data as { body?: unknown; query?: unknown; params?: unknown };
    if (parsed.body !== undefined) req.body = parsed.body;
    if (parsed.params !== undefined) req.params = parsed.params as Request["params"];
    if (parsed.query !== undefined) Object.assign(req.query, parsed.query as object);

    return next();
  };
};
