import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import providerRouter from "./modules/provider/provider.controller";
import { createServer } from "http";
import { initSocket } from "./socket/socket";
import notificationRouter from "./modules/notification/notification.controller";
import favoriteRouter from "./modules/favorite/favorite.controller";
import packageRouter from "./modules/package/package.controller";

// Database
import connectDB from "./DB/connect";

// Routers
import { usersRouter } from "./modules/users/users.controller";
import adminRouter from "./modules/admin/admin.controller";
import authRouter from "./modules/authentication/authentication.controller";
import tourRouter from "./modules/tour/tour.controller";
import hotelRouter from "./modules/hotel/hotel.controller";
import bookingRouter from "./modules/booking/booking.controller";
import carRouter from "./modules/car/car.controller";
import flightRouter from "./modules/flight/flight.controller";

// Middlewares
import { notFound } from "./middleware/notFound.middleware";
import { authMiddleware } from "./middleware/auth.middleware";
import { adminMiddleware } from "./middleware/admin.middleware";
import { auditLogMiddleware } from "./middleware/auditLog.middleware";

// Error Handler
import { globalErrorHandler } from "./utils/response/error.response";

// Models
import AuditLogModel from "./DB/models/auditLog.model";

const app = express();

const port = process.env.PORT || 3000;

// Rate Limiters

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,

  handler: (req, res) => {
    res.status(429).json({
      error_message:
        "Too many requests from this IP, please try again later.",
      name: "TooManyRequestsException",
      statusCode: 429,
    });
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,

  handler: (req, res) => {
    res.status(429).json({
      error_message:
        "Too many authentication attempts, please try again later.",
      name: "TooManyRequestsException",
      statusCode: 429,
    });
  },
});

// Global Middlewares

app.use(helmet());

app.use(cors());

app.use(express.json());

app.use(cookieParser());
app.use(express.static("public"));

app.use(globalLimiter);

app.use(auditLogMiddleware);

// Request Logging Middleware
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url} - body:`, req.body);

  res.on("finish", () => {
    console.log(
      `[${req.method}] ${req.url} - status: ${res.statusCode}`
    );
  });

  next();
});

// API Routes

// Authentication Routes
app.use("/auth", authLimiter, authRouter);

// Main Modules
app.use("/tours", tourRouter);

app.use("/hotels", hotelRouter);

app.use("/api/hotels", hotelRouter);

app.use("/bookings", bookingRouter);

app.use("/cars", carRouter);

app.use("/flights", flightRouter);

app.use("/api/flights", flightRouter);

app.use("/notifications", notificationRouter);

app.use("/favorites", favoriteRouter);

app.use("/packages", packageRouter);

// User Routes
app.use("/users", usersRouter);

// Admin Routes
// Example:
// PATCH /admin/users/:id/role
app.use("/admin", adminRouter);

// Provider Routes
app.use("/provider", providerRouter);

// Admin Audit Logs

app.get(
  "/admin/audit-logs",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    const logs = await AuditLogModel.find()
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      data: logs,
    });
  }
);

// Root Check

app.get("/", (req, res) => {
  res.status(200).json({
    name: "Travel System Marketplace API",

    version: "1.0.0",

    status: "running",

    environment: process.env.NODE_ENV || "development",

    description:
      "Integrated travel marketplace for Tours, Flights, Cars, and Hotels.",

    categories: [
      {
        key: "tours",
        label: "Tours & Activities",
      },
      {
        key: "flights",
        label: "Flights",
      },
      {
        key: "cars",
        label: "Car Rentals",
      },
      {
        key: "hotels",
        label: "Hotels & Rooms",
      },
    ],

    actors: ["guest", "user", "provider", "admin"],

    mainFeatures: [
      "Search & Booking",
      "Role-Based Access (User / Provider / Admin)",
      "Token-Based Email Verification",
      "Real-Time Notifications",
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
      provider: "/provider",
      admin: "/admin",
    },

    documentation: {
      postman: "Coming Soon",
    },

    timestamp: new Date().toISOString(),
  });
});

// 404 Not Found

app.use(notFound);

// Global Error Handler

app.use(globalErrorHandler);

// Export App

export default app;

// HTTP Server + Socket.io

const httpServer = createServer(app);
initSocket(httpServer);

// Start Server

const startServer = async () => {
  await connectDB();

  httpServer.listen(port, () => {
    console.log(
      `[server]: Server is running at http://localhost:${port}`
    );
  });
};

if (process.env.VERCEL !== "1" && process.env.NODE_ENV !== "test") {
  startServer();
}