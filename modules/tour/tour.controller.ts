import { Router, Request, Response, NextFunction } from "express";
import * as tourService from "./tour.service";
import { successResponse } from "../../utils/response/success.response";
import { NotFoundException } from "../../utils/response/error.response";

const router = Router();

router.post("/createTour", (req: Request, res: Response, next: NextFunction) => {
  tourService
    .createTour(req.body)
    .then((tour) => {
      return successResponse({
        res,
        statusCode: 201,
        message: "Tour created successfully",
        data: tour,
      });
    })
    .catch(next);
});

router.get("/", (req: Request, res: Response, next: NextFunction) => {
  tourService
    .getTours(req.query)
    .then((tours) => {
      return successResponse({
        res,
        message: "Tours retrieved successfully",
        data: tours,
      });
    })
    .catch(next);
});

router.get("/:id", (req: Request, res: Response, next: NextFunction) => {
  tourService
    .getTourById(req.params.id)
    .then((tour) => {
      if (!tour) {
        return next(new NotFoundException("Tour not found"));
      }
      return successResponse({
        res,
        message: "Tour retrieved successfully",
        data: tour,
      });
    })
    .catch(next);
});

router.patch("/updateTour/:id", (req: Request, res: Response, next: NextFunction) => {
  tourService
    .updateTour(req.params.id, req.body)
    .then((tour) => {
      if (!tour) {
        return next(new NotFoundException("Tour not found"));
      }
      return successResponse({
        res,
        message: "Tour updated successfully",
        data: tour,
      });
    })
    .catch(next);
});

router.delete("/deleteTour/:id", (req: Request, res: Response, next: NextFunction) => {
  tourService
    .deleteTour(req.params.id)
    .then((tour) => {
      if (!tour) {
        return next(new NotFoundException("Tour not found"));
      }
      return successResponse({
        res,
        message: "Tour deleted successfully",
        data: tour,
      });
    })
    .catch(next);
});

export default router;
