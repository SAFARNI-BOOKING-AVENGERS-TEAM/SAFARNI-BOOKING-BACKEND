import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/requestValidation.middleware";
import { asyncHandler } from "../../utils/response/async.handler";
import {
  CreateCheckoutSessionSchema,
  GetPaymentByIdSchema,
  GetPaymentHistorySchema,
  RefundPaymentSchema,
} from "./payment.validation";
import { checkout, getHistory, getPayment, refund } from "./payment.controller";

const paymentRouter = Router();

// Every route in this router requires a logged-in user. Ownership
// (a user can only see/pay/refund their own payments, unless admin) is
// enforced inside payment.service.ts, not here.
paymentRouter.use(authMiddleware);

paymentRouter.post(
  "/checkout",
  validateRequest(CreateCheckoutSessionSchema),
  asyncHandler(checkout)
);

// NOTE: registered before "/:id" so it isn't swallowed by that param route.
paymentRouter.get(
  "/history",
  validateRequest(GetPaymentHistorySchema),
  asyncHandler(getHistory)
);

paymentRouter.get(
  "/:id",
  validateRequest(GetPaymentByIdSchema),
  asyncHandler(getPayment)
);

paymentRouter.post(
  "/refund/:paymentId",
  validateRequest(RefundPaymentSchema),
  asyncHandler(refund)
);

export default paymentRouter;
