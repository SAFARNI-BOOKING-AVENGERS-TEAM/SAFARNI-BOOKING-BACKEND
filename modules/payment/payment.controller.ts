import { Response } from "express";
import { Types } from "mongoose";
import { IRequest } from "../../types/request.types";
import { UnAuthorizedException } from "../../utils/response/error.response";
import { successResponse } from "../../utils/response/success.response";
import {
  createCheckoutSession,
  createRefund,
  getPaymentById,
  getPaymentHistory,
} from "./payment.service";
import { PaymentStatus } from "../../DB/models/payment.model";

/**
 * Every handler below reads identity from req.credentials (set by
 * authMiddleware) the same way modules/booking/booking.service.ts does,
 * but through the properly-typed IRequest rather than `(req as any)` —
 * the cast pattern used elsewhere in this codebase works, but there's no
 * reason to give up type-checking on a payments module.
 */
function requireAuthenticatedUser(req: IRequest) {
  const user = req.credentials?.user;
  if (!user || !user._id) {
    throw new UnAuthorizedException("Authentication credentials not found");
  }
  return user;
}

export const checkout = async (req: IRequest, res: Response) => {
  const user = requireAuthenticatedUser(req);
  const { bookingId, packageBookingId } = req.body as {
    bookingId?: string;
    packageBookingId?: string;
  };
// Create a new Stripe Checkout Session for the user and the specified booking or package.
// The service layer handles the logic of checking for existing sessions, validating ownership, and preparing the session data.
// The result includes the session ID and URL for redirecting the user to complete the payment.
  const result = await createCheckoutSession({
    userId: new Types.ObjectId(user._id as unknown as string),
    userEmail: user.email,
    bookingId,
    packageBookingId,
  });

  return successResponse({
    res,
    statusCode: 201,
    message: "Checkout session created",
    data: result,
  });
};

export const getPayment = async (req: IRequest, res: Response) => {
  const user = requireAuthenticatedUser(req);
  const isPrivileged = user.role === "admin";

  const payment = await getPaymentById(
    new Types.ObjectId(req.params.id),
    new Types.ObjectId(user._id as unknown as string),
    isPrivileged
  );

  return successResponse({
    res,
    message: "Payment retrieved",
    data: payment,
  });
};

export const getHistory = async (req: IRequest, res: Response) => {
  const user = requireAuthenticatedUser(req);

  const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const status = req.query.status as PaymentStatus | undefined;

  const { items, total, page: resolvedPage, limit: resolvedLimit } =
    await getPaymentHistory(
      new Types.ObjectId(user._id as unknown as string),
      { page, limit, status }
    );

  return successResponse({
    res,
    message: "Payment history retrieved",
    data: items,
    pagination: {
      total,
      page: resolvedPage,
      limit: resolvedLimit,
      pages: Math.max(1, Math.ceil(total / resolvedLimit)),
    },
  });
};

export const refund = async (req: IRequest, res: Response) => {
  const user = requireAuthenticatedUser(req);
  const isPrivileged = user.role === "admin";
  const { amount, reason } = req.body as {
    amount?: number;
    reason: "duplicate" | "fraudulent" | "requested_by_customer";
  };

  const result = await createRefund({
    paymentId: new Types.ObjectId(req.params.paymentId),
    requesterId: new Types.ObjectId(user._id as unknown as string),
    isPrivileged,
    amount,
    reason,
  });

  return successResponse({
    res,
    message: "Refund processed",
    data: result,
  });
};
