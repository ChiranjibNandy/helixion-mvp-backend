import mongoose from "mongoose";
import { AppError } from "../utils/appError.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { getNotificationsRepo, getUnreadNotificationCountRepo, markNotificationAsReadRepo } from "../repositories/notification.repository.js";

export const markNotificationAsReadService = async (
   userId: string,
   notificationId: string
) => {
   if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      throw new AppError(
         "Invalid notification ID",
         HTTP_STATUS.BAD_REQUEST
      );
   }

   const notification =
      await markNotificationAsReadRepo(
         userId,
         notificationId
      );

   if (!notification) {
      throw new AppError(
         "Notification not found",
         HTTP_STATUS.NOT_FOUND
      );
   }

   return notification;
};


export const getNotificationsService = async (
   userId: string
) => {
   const [notifications, unreadCount] = await Promise.all([
      getNotificationsRepo(userId),
      getUnreadNotificationCountRepo(userId),
   ]);

   return {
      notifications,
      unreadCount,
   };
};