import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";

import routes from "./routes";
import webhookRouter from "./modules/payment/payment.webhook";
import { notFound } from "./middleware/notFound.middleware";
import { auditLogMiddleware } from "./middleware/auditLog.middleware";
import { globalErrorHandler } from "./utils/response/error.response";

const app = express();

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error_message: "Too many requests from this IP, please try again later.",
      name: "TooManyRequestsException",
      statusCode: 429,
    });
  },
});

// Stripe requires the unparsed body for signature verification.
app.use("/webhooks/stripe", express.raw({ type: "application/json", limit: "1mb" }));
app.use("/webhooks", webhookRouter);

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(express.static("public"));
// When Cloudinary is not configured, Multer stores development uploads here.
// Expose only this dedicated upload directory so returned image URLs are
// browser-accessible without exposing the rest of the project filesystem.
app.use("/uploads", express.static("uploads"));
app.use(globalLimiter);
app.use(auditLogMiddleware);

// Never log request bodies: they can contain passwords, payment metadata or PII.
if (process.env.NODE_ENV !== "test") {
  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on("finish", () => {
      console.log(`[${req.method}] ${req.path} - ${res.statusCode} - ${Date.now() - startedAt}ms`);
    });
    next();
  });
}

app.use(routes);
app.use(notFound);
app.use(globalErrorHandler);

export default app;
