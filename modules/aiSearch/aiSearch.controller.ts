import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../../utils/response/async.handler";
import { successResponse } from "../../utils/response/success.response";
import { validateRequest } from "../../middleware/requestValidation.middleware";
import { AISearchFlightsSchema } from "./types/zod.types";
import { getAISearchDiagnostics, searchFlightsFromPrompt } from "./aiSearch.service";
import { authMiddleware } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/admin.middleware";

const aiSearchRouter = Router();

const aiSearchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 8 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many AI flight searches. Please wait a moment and try again.",
      statusCode: 429,
    });
  },
});

aiSearchRouter.post(
  "/flights",
  aiSearchLimiter,
  validateRequest(AISearchFlightsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await searchFlightsFromPrompt(req.body.prompt);
    return successResponse({
      res,
      message:
        result.status === "needs_input"
          ? "More trip information is required"
          : "Live flight deals retrieved successfully",
      data: result,
    });
  })
);

aiSearchRouter.get(
  "/status",
  authMiddleware,
  authorizeRoles("admin"),
  asyncHandler(async (_req: Request, res: Response) => {
    return successResponse({
      res,
      message: "AI search diagnostics retrieved successfully",
      data: getAISearchDiagnostics(),
    });
  })
);

export default aiSearchRouter;
