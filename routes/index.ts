import { Router } from "express";
import rateLimit from "express-rate-limit";
import esimRouter from "../modules/esim/esim.controller";

// Routers
import providerRouter from "../modules/provider/provider.controller";
import notificationRouter from "../modules/notification/notification.controller";
import favoriteRouter from "../modules/favorite/favorite.controller";
import packageRouter from "../modules/package/package.controller";
import { usersRouter } from "../modules/users/users.controller";
import adminRouter from "../modules/admin/admin.controller";
import authRouter from "../modules/authentication/authentication.controller";
import tourRouter from "../modules/tour/tour.controller";
import hotelRouter from "../modules/hotel/hotel.controller";
import bookingRouter from "../modules/booking/booking.controller";
import carRouter from "../modules/car/car.controller";
import flightRouter from "../modules/flight/flight.controller";
import paymentRouter from "../modules/payment/payment.controller";
import aiSearchRouter from "../modules/aiSearch/aiSearch.controller";

const router = Router();

// Rate limiter specific to authentication routes (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 10 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error_message: "Too many authentication attempts, please try again later.",
      name: "TooManyRequestsException",
      statusCode: 429,
    });
  },
});

router.use("/auth", authLimiter, authRouter);
router.use("/tours", tourRouter);
router.use("/hotels", hotelRouter);
router.use("/api/hotels", hotelRouter);
router.use("/bookings", bookingRouter);
router.use("/cars", carRouter);
router.use("/flights", flightRouter);
router.use("/api/flights", flightRouter);
router.use("/notifications", notificationRouter);
router.use("/favorites", favoriteRouter);
router.use("/packages", packageRouter);
router.use("/users", usersRouter);
router.use("/admin", adminRouter);
router.use("/provider", providerRouter);
router.use("/esim", esimRouter);
router.use("/payments", paymentRouter);
router.use("/ai-search", aiSearchRouter);

router.get("/", (_req, res) => {
  res.status(200).json({
    name: "Travel System Marketplace API",
    version: "1.0.0",
    status: "running",
    environment: process.env.NODE_ENV || "development",
    description: "Integrated travel marketplace for Tours, Flights, Cars, and Hotels.",
    categories: [
      { key: "tours", label: "Tours & Activities" },
      { key: "flights", label: "Flights" },
      { key: "cars", label: "Car Rentals" },
      { key: "hotels", label: "Hotels & Rooms" },
    ],
    actors: ["guest", "user", "provider", "admin"],
    mainFeatures: [
      "Search & Booking",
      "AI-Assisted Live Flight Search",
      "Role-Based Access (User / Provider / Admin)",
      "Token-Based Email Verification",
      "Real-Time Notifications",
      "Curated & Provider Packages",
      "Reviews & Favorites",
    ],
    api: {
      auth: "/auth",
      users: "/users",
      tours: "/tours",
      flights: "/flights",
      cars: "/cars",
      hotels: "/hotels",
      bookings: "/bookings",
      notifications: "/notifications",
      favorites: "/favorites",
      packages: "/packages",
      provider: "/provider",
      admin: "/admin",
      aiSearch: "/ai-search",
    },
    documentation: { postman: "Coming Soon" },
    timestamp: new Date().toISOString(),
  });
});

export default router;