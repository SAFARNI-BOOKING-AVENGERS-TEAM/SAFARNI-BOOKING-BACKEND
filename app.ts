import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";

import routes from "./routes";
import { notFound } from "./middleware/notFound.middleware";
import { auditLogMiddleware } from "./middleware/auditLog.middleware";
import { globalErrorHandler } from "./utils/response/error.response";

const app = express();

// Rate Limiters

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error_message: "Too many requests from this IP, please try again later.",
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
    console.log(`[${req.method}] ${req.url} - status: ${res.statusCode}`);
  });
  next();
});

// API Routes

app.use(routes);

// 404 Not Found

app.use(notFound);

// Global Error Handler

app.use(globalErrorHandler);

export default app;