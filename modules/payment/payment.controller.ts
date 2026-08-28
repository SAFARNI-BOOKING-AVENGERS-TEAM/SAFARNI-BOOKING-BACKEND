import { Router, Request, Response } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/admin.middleware";
import { validateRequest } from "../../middleware/requestValidation.middleware";
import { asyncHandler } from "../../utils/response/async.handler";
import { successResponse } from "../../utils/response/success.response";
import { getStripeDiagnostics } from "../../utils/payment/stripeClient";
import {
  CreatePaymentIntentSchema,
  CreateCheckoutSessionSchema,
  ConfirmPaymentSchema,
} from "./types/zod.types";
import {
  createPaymentIntent,
  createCheckoutSession,
  verifyCheckoutSession,
  confirmPayment,
} from "./payment.service";

const paymentRouter = Router();

paymentRouter.get(
  "/status",
  authMiddleware,
  authorizeRoles("admin"),
  asyncHandler(async (_req: Request, res: Response) => {
    const diagnostics = await getStripeDiagnostics();
    return successResponse({
      res,
      message: "Stripe diagnostics retrieved successfully",
      data: diagnostics,
    });
  })
);

paymentRouter.post(
  "/checkout-session",
  authMiddleware,
  validateRequest(CreateCheckoutSessionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).credentials.user._id;
    const result = await createCheckoutSession(userId, {
      bookingId: req.body.bookingId,
      packageBookingId: req.body.packageBookingId,
      esimOrderId: req.body.esimOrderId,
    });
    return successResponse({
      res,
      statusCode: 201,
      message: "Checkout session created successfully",
      data: result,
    });
  })
);

paymentRouter.get(
  "/checkout-session/:sessionId",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).credentials.user._id;
    const result = await verifyCheckoutSession(userId, String(req.params.sessionId));
    return successResponse({
      res,
      message: "Checkout session verified successfully",
      data: result,
    });
  })
);

paymentRouter.post(
  "/create-intent",
  authMiddleware,
  validateRequest(CreatePaymentIntentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).credentials.user._id;
    const result = await createPaymentIntent(userId, {
      bookingId: req.body.bookingId,
      packageBookingId: req.body.packageBookingId,
      esimOrderId: req.body.esimOrderId,
    });
    return successResponse({
      res,
      statusCode: 201,
      message: "Payment intent created successfully",
      data: result,
    });
  })
);

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
