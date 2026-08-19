import { Router, Request, Response } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../utils/response/async.handler";
import { successResponse } from "../../utils/response/success.response";
import { BadRequestException, ConflictException, NotFoundException } from "../../utils/response/error.response";
import FavoriteModel from "../../DB/models/favorite.model";
import TourModel from "../../DB/models/tour.model";
import HotelModel from "../../DB/models/hotel.model";
import CarModel from "../../DB/models/car.model";
import FlightModel from "../../DB/models/flight.model";

const favoriteRouter = Router();

const modelsByCategory: Record<string, any> = {
  tours: TourModel,
  hotels: HotelModel,
  cars: CarModel,
  flights: FlightModel,
};

// POST /favorites  — add an item to my favorites
favoriteRouter.post(
  "/",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).credentials.user._id;
    const { category, itemId } = req.body;

    if (!modelsByCategory[category]) {
      throw new BadRequestException(
        "category must be one of: tours, hotels, cars, flights"
      );
    }

    const item = await modelsByCategory[category].findById(itemId);
    if (!item) {
      throw new NotFoundException(`${category.slice(0, -1)} not found`);
    }

    try {
      const favorite = await FavoriteModel.create({ userId, category, itemId });
      return successResponse({
        res,
        statusCode: 201,
        message: "Added to favorites successfully",
        data: favorite,
      });
    } catch (err: any) {
      if (err.code === 11000) {
        throw new ConflictException("This item is already in your favorites");
      }
      throw err;
    }
  })
);

// DELETE /favorites/:category/:itemId — remove from favorites
favoriteRouter.delete(
  "/:category/:itemId",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).credentials.user._id;
    const { category, itemId } = req.params as {
      category: "tours" | "hotels" | "cars" | "flights";
      itemId: string;
    };

    const favorite = await FavoriteModel.findOneAndDelete({
      userId,
      category,
      itemId,
    });

    if (!favorite) {
      throw new NotFoundException("This item is not in your favorites");
    }

    return successResponse({
      res,
      message: "Removed from favorites successfully",
    });
  })
);

// GET /favorites — list my favorites, with the actual item details populated
favoriteRouter.get(
  "/",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).credentials.user._id;
    const favorites = await FavoriteModel.find({ userId }).sort({ createdAt: -1 });

    const withDetails = await Promise.all(
      favorites.map(async (fav) => {
        const item = await modelsByCategory[fav.category].findById(fav.itemId);
        return {
          favoriteId: fav._id,
          category: fav.category,
          itemId: fav.itemId,
          addedAt: fav.createdAt,
          item, // null if the item was later deleted
        };
      })
    );

    return successResponse({
      res,
      message: "Favorites retrieved successfully",
      data: withDetails,
    });
  })
);

export default favoriteRouter;