import { Router, Request, Response } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/requestValidation.middleware";
import { asyncHandler } from "../../utils/response/async.handler";
import { successResponse } from "../../utils/response/success.response";
import { CreatePaymentIntentSchema, ConfirmPaymentSchema } from "./types/zod.types";
import { createPaymentIntent, confirmPayment } from "./payment.service";

const paymentRouter = Router();

// POST /payments/create-intent — start a payment for a booking
paymentRouter.post(
  "/create-intent",
  authMiddleware,
  validateRequest(CreatePaymentIntentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).credentials.user._id;
    const result = await createPaymentIntent(userId, req.body.bookingId);
    return successResponse({
      res,
      statusCode: 201,
      message: "Payment intent created successfully",
      data: result,
    });
  })
);

// POST /payments/confirm — confirm a payment succeeded (verified against Stripe)
paymentRouter.post(
  "/confirm",
  authMiddleware,
  validateRequest(ConfirmPaymentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).credentials.user._id;
    const payment = await confirmPayment(userId, req.body.paymentIntentId);
    return successResponse({
      res,
      message: "Payment confirmed successfully",
      data: payment,
    });
  })
);

export default paymentRouter;