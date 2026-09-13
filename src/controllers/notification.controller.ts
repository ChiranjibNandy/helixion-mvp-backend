import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/appError.js";
import { MESSAGES } from "../constants/messages.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { markNotificationAsReadService } from "../services/notification.service.js";

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