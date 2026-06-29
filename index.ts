import dotenv from "dotenv";
dotenv.config();

import { usersRouter } from "./modules/users/users.controller";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import connectDB from "./DB/connect";
import { notFound } from "./middleware/notFound.middleware";
import { globalErrorHandler } from "./utils/response/error.response";
import authRouter from "./modules/authentication/authentication.controller";
import cookieParser from "cookie-parser";
import 'dotenv/config';

import tourRouter from "./modules/tour/tour.controller";
import hotelRouter from "./modules/hotel/hotel.controller";
import bookingRouter from "./modules/booking/booking.controller";
import carRouter from "./modules/car/car.controller";
import flightRouter from "./modules/flight/flight.controller";

const app = express();
const port = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(cookieParser());

app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url} - body:`, req.body);
  res.on('finish', () => {
    console.log(`[${req.method}] ${req.url} - status: ${res.statusCode}`);
  });
  next();
});

app.use("/auth", authRouter);
app.use("/tours", tourRouter);
app.use("/hotels", hotelRouter);
app.use("/api/hotels", hotelRouter);
app.use("/bookings", bookingRouter);
app.use("/cars", carRouter);
app.use("/flights", flightRouter);
app.use("/api/flights", flightRouter);

app.use("/users", usersRouter);

app.get("/", (req, res) => {
  res.status(200).json({
    name: "Travel System Marketplace API",
    version: "1.0.0",
    status: "running",
    environment: process.env.NODE_ENV || "development",

    description:
      "Integrated travel marketplace for Tours, Flights, Cars, and Hotels.",

    categories: [
      { key: "tours", label: "Tours & Activities" },
      { key: "flights", label: "Flights" },
      { key: "cars", label: "Car Rentals" },
      { key: "hotels", label: "Hotels & Rooms" },
    ],

    actors: ["guest", "user", "admin", "support"],

    mainFeatures: [
      "Search & Booking",
      "Secure Payments",
      "OTP Authentication",
      "Reviews & Favorites",
      "Multi-language & Multi-currency",
    ],

    api: {
      auth: "/auth",
      users: "/users",
      tours: "/tours",
      flights: "/flights",
      cars: "/cars",
      hotels: "/hotels",
      bookings: "/bookings",
      payments: "/payments",
      admin: "/admin",
    },

    documentation: {
      postman: "Coming Soon",
    },

    timestamp: new Date().toISOString(),
  });
});

app.use(notFound);

app.use(globalErrorHandler);

export default app;

const startServer = async () => {
  await connectDB();
  app.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
  });
};

if (process.env.VERCEL !== "1") {
  startServer();
}
// Reload nodemon for search filter fix
