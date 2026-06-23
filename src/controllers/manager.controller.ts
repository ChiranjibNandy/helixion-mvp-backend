import { Request, Response, NextFunction } from "express";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { AppError } from "../utils/appError.js";
import { getManagerDashboardService } from "../services/employee.service.js";

export const getManagerDashboard = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const userId = req.userId;
      if (!userId) {
         throw new AppError(MESSAGES.USER_ID_REQUIRED, HTTP_STATUS.UNAUTHORIZED);
      }
      const dashboard = await getManagerDashboardService(userId);
      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.MANAGER_DASHBOARD_FETCH,
         data: dashboard,
      });
   } catch (error) {
      next(error);
   }
};
