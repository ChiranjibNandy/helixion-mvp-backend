import { NextFunction, Request, Response } from "express";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { AppError } from "../utils/appError.js";
import { getEmployeeDashboardService } from "../services/employee.service.js";

/**
 * Fetch employee dashboard enrollments and available active programs.
 *
 * Route:
 * GET /api/employee/dashboard
 *
 * Access:
 * Employee (Authenticated)
 *
 * Request:
 * - userId (from authenticated token / middleware)
 *
 * Returns:
 * - summary
 * - Chart Data (approvalStats)
 * - available active programs
 */
export const getEmployeeDashboard =
   async (req: Request, res: Response, next: NextFunction) => {
      try {
         const userId = req.userId;

         if (!userId) {
            throw new AppError(
               MESSAGES.USER_ID_REQUIRED,
               HTTP_STATUS.UNAUTHORIZED
            );
         }

         const dashboard =
            await getEmployeeDashboardService(userId);

         return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: MESSAGES.DASHBOARD_DATA_FETCH,
            data: dashboard
         });
      } catch (error) {
         next(error);
      }
   };

