import { Request, Response, Router } from "express";
import { HotelService } from "./hotel.service";
import { upload } from "../../middleware/upload";
import { asyncHandler } from "../../utils/response/async.handler";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const hotels = await HotelService.getHotels(req.query);

    res.status(200).json({
      success: true,
      count: hotels.length,
      data: hotels,
    });
  })
);

router.get(
  "/:hotelId",
  asyncHandler(async (req: Request, res: Response) => {
    const { hotelId } = req.params;

    const data = await HotelService.getHotelDetails(hotelId);

    res.status(200).json({
      success: true,
      data,
    });
  })
);

router.post(
  "/admin/hotels",
  asyncHandler(async (req: Request, res: Response) => {
    const hotel = await HotelService.createHotel(req.body);

    res.status(201).json({
      success: true,
      data: hotel,
    });
  })
);

router.post(
  "/admin/:hotelId/rooms",
  asyncHandler(async (req: Request, res: Response) => {
    const { hotelId } = req.params;
    const room = await HotelService.createRoom(hotelId, req.body);

    res.status(201).json({
      success: true,
      data: room,
    });
  })
);

router.post(
  "/admin/:hotelId/images",
  upload.array("images", 5),
  asyncHandler(async (req: Request, res: Response) => {
    const gallery = await HotelService.addHotelImages(
      req.params.hotelId,
      (req as any).files as any[]
    );

    res.status(200).json({
      success: true,
      data: gallery,
    });
  })
);

router.patch(
  "/admin/rooms/:roomId",
  asyncHandler(async (req: Request, res: Response) => {
    const { roomId } = req.params;
    const room = await HotelService.updateRoom(roomId, req.body);

    res.status(200).json({
      success: true,
      data: room,
    });
  })
);

router.delete(
  "/admin/rooms/:roomId",
  asyncHandler(async (req: Request, res: Response) => {
    const { roomId } = req.params;
    const room = await HotelService.deleteRoom(roomId);

    res.status(200).json({
      success: true,
      message: "Room deleted successfully",
      data: room,
    });
  })
);

export default router;