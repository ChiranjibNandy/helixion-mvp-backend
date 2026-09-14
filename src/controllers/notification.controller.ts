import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/appError.js";
import { MESSAGES } from "../constants/messages.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { getNotificationsService, markNotificationAsReadService } from "../services/notification.service.js";

export const markNotificationAsRead = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const userId = req.userId;
      const notificationId = req.params.id;

      if (!userId) {
         throw new AppError(
            MESSAGES.USER_ID_REQUIRED,
            HTTP_STATUS.UNAUTHORIZED
         );
      }

      if (!notificationId) {
         throw new AppError(
            MESSAGES.NOTIFICATION_ID_REQUIRED,
            HTTP_STATUS.BAD_REQUEST
         );
      }

      await markNotificationAsReadService(
         userId,
         String(notificationId)
      );

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.NOTIFICATION_MARKED_AS_READ,
      });
   } catch (error) {
      next(error);
   }
};



export const getNotifications = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const userId = req.userId;

      if (!userId) {
         throw new AppError(
            MESSAGES.USER_ID_REQUIRED,
            HTTP_STATUS.UNAUTHORIZED
         );
      }

      const notifications =
         await getNotificationsService(userId);

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.NOTIFICATIONS_FETCHED,
         data: notifications,
      });
   } catch (error) {
      next(error);
   }
};