import { Request, Response, NextFunction } from "express";
import AuditLogModel from "../DB/models/auditLog.model";

const AUDITED_METHODS = ["POST", "PATCH", "DELETE", "PUT"];

export const auditLogMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!AUDITED_METHODS.includes(req.method)) {
    return next();
  }

  res.on("finish", () => {
    const user = (req as any).credentials?.user;

    AuditLogModel.create({
      userId: user?._id || null,
      userEmail: user?.email || "anonymous",
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      success: res.statusCode < 400,
    }).catch((err) => {
      console.error("Failed to write audit log:", err.message);
    });
  });

  next();
};