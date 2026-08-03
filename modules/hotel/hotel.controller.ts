import {
  Request,
  Response,
  Router,
} from "express";

import { HotelService } from "./hotel.service";

import { upload } from "../../middleware/upload";

import { asyncHandler } from "../../utils/response/async.handler";

import { validateRequest } from "../../middleware/requestValidation.middleware";

import {
  CreateHotelSchema,
  CreateRoomSchema,
  UpdateRoomSchema,
} from "./types/zod.types";

import { authMiddleware } from "../../middleware/auth.middleware";

import { authorizeRoles } from "../../middleware/admin.middleware";

import { successResponse } from "../../utils/response/success.response";

import { optionalAuthMiddleware } from "../../middleware/optionalAuth.middleware";

import { BadRequestException } from "../../utils/response/error.response";

import { requireProviderType } from "../../middleware/providerType.middleware";

const router = Router();

// GET ALL HOTELS
router.get(
  "/",
  optionalAuthMiddleware,

  asyncHandler(
    async (req: Request, res: Response) => {
      const user = (req as any).credentials?.user;

      const userRole = user?.role;
      const userId = user?._id;

      const result =
        await HotelService.getHotels(
          req.query,
          userRole,
          userId
        );

      res.status(200).json({
        success: true,
        count: result.data.length,
        pagination: result.pagination,
        data: result.data,
      });
    }
  )
);

// GET HOTEL BY ID
router.get(
  "/:hotelId",

  optionalAuthMiddleware,

  asyncHandler(
    async (req: Request, res: Response) => {
      const user =
        (req as any).credentials?.user;

      const data =
        await HotelService.getHotelDetails(
          req.params.hotelId,
          user?.role,
          user?._id
        );

      res.status(200).json({
        success: true,
        data,
      });
    }
  )
);

// CREATE HOTEL
// Provider -> pending
// Admin -> approved

router.post(
  "/admin/hotels",

  authMiddleware,

  authorizeRoles(
    "admin",
    "provider"
  ),
requireProviderType("travel", "both"),
  validateRequest(
    CreateHotelSchema
  ),

  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const user =
        (req as any).credentials
          ?.user;

      const hotel =
        await HotelService.createHotel(
          req.body,
          user._id,
          user.role
        );

      return successResponse({
        res,
        statusCode: 201,
        message:
          "Hotel created successfully",
        data: hotel,
      });
    }
  )
);

// UPDATE HOTEL
router.patch(
  "/admin/hotels/:hotelId",

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
        (req as any).credentials
          ?.user;

      const hotel =
        await HotelService.updateHotel(
          req.params.hotelId,
          req.body,
          user._id,
          user.role
        );

      return successResponse({
        res,
        message:
          "Hotel updated successfully",
        data: hotel,
      });
    }
  )
);

// DELETE HOTEL
router.delete(
  "/admin/hotels/:hotelId",

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
        (req as any).credentials
          ?.user;

      const hotel =
        await HotelService.deleteHotel(
          req.params.hotelId,
          user._id,
          user.role
        );

      return successResponse({
        res,
        message:
          "Hotel deleted successfully",
        data: hotel,
      });
    }
  )
);

// CREATE ROOM
router.post(
  "/admin/:hotelId/rooms",

  authMiddleware,

  authorizeRoles(
    "admin",
    "provider"
  ),

  validateRequest(
    CreateRoomSchema
  ),

  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const user =
        (req as any).credentials
          ?.user;

      const room =
        await HotelService.createRoom(
          req.params.hotelId,
          req.body,
          user._id,
          user.role
        );

      return successResponse({
        res,
        statusCode: 201,
        message:
          "Room created successfully",
        data: room,
      });
    }
  )
);

// UPLOAD HOTEL IMAGES
router.post(
  "/admin/:hotelId/images",

  authMiddleware,

  authorizeRoles(
    "admin",
    "provider"
  ),

  upload.array(
    "images",
    5
  ),

  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const user =
        (req as any).credentials
          ?.user;

      const files =
        (req.files as Express.Multer.File[]) ||
        [];

      if (!files.length) {
        throw new BadRequestException(
          "At least one image is required"
        );
      }

      const gallery =
        await HotelService.addHotelImages(
          req.params.hotelId,
          files,
          user._id,
          user.role
        );

      return successResponse({
        res,
        message:
          "Hotel images uploaded successfully",
        data: gallery,
      });
    }
  )
);

// UPDATE ROOM
router.patch(
  "/admin/rooms/:roomId",

  authMiddleware,

  authorizeRoles(
    "admin",
    "provider"
  ),

  validateRequest(
    UpdateRoomSchema
  ),

  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const user =
        (req as any).credentials
          ?.user;

      const room =
        await HotelService.updateRoom(
          req.params.roomId,
          req.body,
          user._id,
          user.role
        );

      return successResponse({
        res,
        message:
          "Room updated successfully",
        data: room,
      });
    }
  )
);

// DELETE ROOM
router.delete(
  "/admin/rooms/:roomId",

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
        (req as any).credentials
          ?.user;

      const room =
        await HotelService.deleteRoom(
          req.params.roomId,
          user._id,
          user.role
        );

      return successResponse({
        res,
        message:
          "Room deleted successfully",
        data: room,
      });
    }
  )
);

// ADMIN APPROVE / REJECT HOTEL
router.patch(
  "/admin/hotels/:hotelId/status",

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

      const hotel =
        await HotelService.updateHotelStatus(
          req.params.hotelId,
          status,
          adminId
        );

      return successResponse({
        res,
        message:
          `Hotel ${status} successfully`,
        data: hotel,
      });
    }
  )
);

export default router;