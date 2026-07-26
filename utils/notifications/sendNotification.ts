import NotificationModel, { INotification } from "../../DB/models/notification.model";
import { io } from "../../index";

export const sendNotification = async (
  userId: string,
  data: {
    title: string;
    message: string;
    type: INotification["type"];
    relatedId?: string;
  }
) => {
  const notification = await NotificationModel.create({
    userId,
    ...data,
  });

  // If the user is currently connected, push it to them in real-time too
  io.to(userId.toString()).emit("notification", notification);

  return notification;
};