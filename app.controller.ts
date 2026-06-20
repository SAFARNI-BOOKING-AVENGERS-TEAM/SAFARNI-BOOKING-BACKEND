//Get main libraries to build server
import { Application, Request, Response } from "express";

//Get tourRouter from modules 
import tourRouter from "./modules/tour/tour.controller";
//Get hotelRouter from modules
import hotelRouter from "./modules/hotel/hotel.controller";

//start function called(Bootstrap function) get app as intro to programme it
export const bootstrap = (app: Application) => {
 
  // Root Check to check server is running
  app.get("/", (req: Request, res: Response) => {
    res.send("Express + TypeScript Server is running!");
  });

  // Module Routes
  app.use("/tours", tourRouter);
  // 
  app.use("/hotels", hotelRouter);
};

  