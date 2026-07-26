import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import providerRouter from "./modules/provider/provider.controller";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";

// Database
import connectDB from "./DB/connect";

// Security
import { verifyToken, TokenType } from "./utils/security/token.security";

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

    actors: [
      "guest",
      "user",
      "provider",
      "admin",
      "support",
    ],

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

// 404 Not Found

app.use(notFound);

// Global Error Handler

app.use(globalErrorHandler);

// Export App

export default app;

// HTTP Server + Socket.io

const httpServer = createServer(app);

export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    credentials: true,
  },
});

// Authenticate every socket connection using the same JWT from cookies
io.use(async (socket, next) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie;
    if (!cookieHeader) {
      return next(new Error("Authentication required"));
    }

    const parsedCookies = Object.fromEntries(
      cookieHeader.split("; ").map((c) => {
        const [key, ...v] = c.split("=");
        return [key, v.join("=")];
      })
    );

    const token = parsedCookies["access_token"];
    if (!token) {
      return next(new Error("Authentication required"));
    }

    const { user } = await verifyToken(token, TokenType.access);
    (socket as any).userId = user._id.toString();
    next();
  } catch (err) {
    next(new Error("Invalid or expired token"));
  }
});

io.on("connection", (socket) => {
  const userId = (socket as any).userId;
  socket.join(userId); // each user gets a private "room" named after their own ID
  console.log(`[socket]: User ${userId} connected`);

  socket.on("disconnect", () => {
    console.log(`[socket]: User ${userId} disconnected`);
  });
});

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