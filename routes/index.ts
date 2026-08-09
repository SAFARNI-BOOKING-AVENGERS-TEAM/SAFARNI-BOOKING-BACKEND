import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authMiddleware } from "../middleware/auth.middleware";
import { adminMiddleware } from "../middleware/admin.middleware";
import AuditLogModel from "../DB/models/auditLog.model";
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

const router = Router();

// Rate limiter specific to authentication routes (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
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

router.get("/admin/audit-logs", authMiddleware, adminMiddleware, async (req, res) => {
  const logs = await AuditLogModel.find().sort({ createdAt: -1 }).limit(50);
  res.json({ success: true, data: logs });
});

router.get("/", (req, res) => {
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
    },
    documentation: { postman: "Coming Soon" },
    timestamp: new Date().toISOString(),
  });
});

export default router;