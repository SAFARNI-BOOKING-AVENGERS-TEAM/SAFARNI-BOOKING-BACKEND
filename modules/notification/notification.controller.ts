import { Router, Request, Response } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../utils/response/async.handler";
import { successResponse } from "../../utils/response/success.response";
import { NotFoundException, UnAuthorizedException } from "../../utils/response/error.response";
import NotificationModel from "../../DB/models/notification.model";

const notificationRouter = Router();

// GET /notifications  — list my notifications (paginated, newest first)
notificationRouter.get(
  "/",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).credentials.user._id;
    const { page, limit } = req.query;

    const currentPage = Math.max(Number(page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const skip = (currentPage - 1) * pageSize;

    const [data, total, unreadCount] = await Promise.all([
      NotificationModel.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
      NotificationModel.countDocuments({ userId }),
      NotificationModel.countDocuments({ userId, isRead: false }),
    ]);

    return successResponse({
      res,
      message: "Notifications retrieved successfully",
      data,
      pagination: {
        total,
        page: currentPage,
        pages: Math.ceil(total / pageSize),
        limit: pageSize,
      },
      info: { unreadCount },
    });
  })
);

// PATCH /notifications/:id/read — mark one notification as read
notificationRouter.patch(
  "/:id/read",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).credentials.user._id;
    const notification = await NotificationModel.findById(req.params.id);

    if (!notification) {
      throw new NotFoundException("Notification not found");
    }
    if (notification.userId.toString() !== userId.toString()) {
      throw new UnAuthorizedException("You cannot access another user's notification");
    }

    notification.isRead = true;
    await notification.save();

    return successResponse({
      res,
      message: "Notification marked as read",
      data: notification,
    });
  })
);

// PATCH /notifications/read-all — mark everything as read
notificationRouter.patch(
  "/read-all",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).credentials.user._id;
    await NotificationModel.updateMany({ userId, isRead: false }, { isRead: true });

    return successResponse({
      res,
      message: "All notifications marked as read",
    });
  })
);

export default notificationRouter;