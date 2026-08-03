import { Router, Request, Response } from "express";

import * as tourService from "./tour.service";

import { successResponse } from "../../utils/response/success.response";

import { validateRequest } from "../../middleware/requestValidation.middleware";
import { AddReviewSchema } from "./types/zod.types";
import { addOrUpdateReview, getTourReviews, deleteReview } from "./tour.service";
import { requireProviderType } from "../../middleware/providerType.middleware";
import {
  CreateTourSchema,
  UpdateTourSchema,
} from "./types/zod.types";

import { authMiddleware } from "../../middleware/auth.middleware";

import { authorizeRoles } from "../../middleware/admin.middleware";

import { optionalAuthMiddleware } from "../../middleware/optionalAuth.middleware";

import {
  BadRequestException,
} from "../../utils/response/error.response";

import { asyncHandler } from "../../utils/response/async.handler";

const router = Router();

// PUBLIC - GET ALL TOURS
// Public:
// - Guest -> approved tours only
// - User -> approved tours only
// - Provider -> approved + own tours
// - Admin -> all tours

router.get(
  "/",
  optionalAuthMiddleware,

  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const user =
        (req as any).credentials?.user;

      const result =
        await tourService.getTours(
          req.query,
          user?.role,
          user?._id
        );

      return successResponse({
        res,
        message:
          "Tours retrieved successfully",
        data: result.data,
        pagination:
          result.pagination,
      });
    }
  )
);

// PUBLIC - GET TOUR BY ID

router.get(
  "/:id",
  optionalAuthMiddleware,

  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const user =
        (req as any).credentials?.user;

      const tour =
        await tourService.getTourById(
          req.params.id,
          user?.role,
          user?._id
        );

      return successResponse({
        res,
        message:
          "Tour retrieved successfully",
        data: tour,
      });
    }
  )
);

// CREATE TOUR
// Provider -> pending
// Admin -> approved

router.post(
  "/createTour",

  authMiddleware,

  authorizeRoles(
    "admin",
    "provider"
  ),
requireProviderType("travel", "both"),
  validateRequest(
    CreateTourSchema
  ),

  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const user =
        (req as any).credentials?.user;

      const tour =
        await tourService.createTour(
          req.body,
          user._id,
          user.role
        );

      return successResponse({
        res,
        statusCode: 201,
        message:
          "Tour created successfully",
        data: tour,
      });
    }
  )
);

// UPDATE TOUR
// Provider -> own tours only
// Admin -> any tour

router.patch(
  "/updateTour/:id",

  authMiddleware,

  authorizeRoles(
    "admin",
    "provider"
  ),

  validateRequest(
    UpdateTourSchema
  ),

  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const user =
        (req as any).credentials?.user;

      const tour =
        await tourService.updateTour(
          req.params.id,
          req.body,
          user._id,
          user.role
        );

      return successResponse({
        res,
        message:
          "Tour updated successfully",
        data: tour,
      });
    }
  )
);

// DELETE TOUR
// Provider -> own tours only
// Admin -> any tour
// Cannot delete if active booking exists

router.delete(
  "/deleteTour/:id",

  authMiddleware,

  authorizeRoles(
    "admin",
    "provider"
  ),

  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const user =
        (req as any).credentials?.user;

      const tour =
        await tourService.deleteTour(
          req.params.id,
          user._id,
          user.role
        );

      return successResponse({
        res,
        message:
          "Tour deleted successfully",
        data: tour,
      });
    }
  )
);

// ADMIN APPROVE / REJECT TOUR

router.patch(
  "/admin/tours/:tourId/status",

  authMiddleware,

  authorizeRoles("admin"),

  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const {
        status,
      } = req.body;

      if (
        status !== "approved" &&
        status !== "rejected"
      ) {
        throw new BadRequestException(
          "Status must be approved or rejected"
        );
      }

      const adminId =
        (req as any).credentials
          ?.user?._id;

      const tour =
        await tourService.updateTourStatus(
          req.params.tourId,
          status,
          adminId
        );

      return successResponse({
        res,
        message:
          `Tour ${status} successfully`,
        data: tour,
      });
    }
  )
);
// ADD REVIEW
router.post(
  "/:id/reviews",
  authMiddleware,
  validateRequest(AddReviewSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).credentials.user._id;
    const { rating, comment } = req.body;
    const reviews = await addOrUpdateReview(req.params.id, userId, rating, comment);
    return successResponse({ res, message: "Review submitted successfully", data: reviews });
  })
);
// GET TOUR REVIEWS
router.get(
  "/:id/reviews",
  asyncHandler(async (req: Request, res: Response) => {
    const data = await getTourReviews(req.params.id);
    return successResponse({ res, message: "Reviews retrieved successfully", data });
  })
);
// DELETE REVIEW
router.delete(
  "/:id/reviews/:reviewUserId",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).credentials.user;
    const reviews = await deleteReview(req.params.id, req.params.reviewUserId, user._id, user.role);
    return successResponse({ res, message: "Review deleted successfully", data: reviews });
  })
);

export default router;
