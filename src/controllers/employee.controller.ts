import { NextFunction, Request, Response } from "express";
import { getDashboardEnrollmentsService } from "../services/employee.service.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { AppError } from "../utils/appError.js";
import { programResponseMapper } from "../mapper/program.mapper.js";

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
 * - enrolled programs
 * - available active programs
 */
export const getDashboardEnrollments =
   async (req: Request, res: Response, next: NextFunction) => {
      try {
         const userId = req.userId
         if (!userId) {
            return new AppError(MESSAGES.USER_ID_REQUIRED, HTTP_STATUS.UNAUTHORIZED)
         }
         const {
            enrollments,
            availablePrograms
         } = await getDashboardEnrollmentsService(userId);

         return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: MESSAGES.ACTIVE_ENROLL_AND_AVAILABLE_PROGRAM,
            data: {
               enrollments,
               availablePrograms:programResponseMapper(availablePrograms)
            }
         });

      } catch (error) {
         next(error)
      }
   };