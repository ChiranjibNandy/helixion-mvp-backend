import { NextFunction, Request, Response } from "express";
import { getDashboardEnrollmentsService } from "../services/employee.service.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";

// Return all enrolled programs and available active programs for employee
export const getDashboardEnrollments =
   async (req: Request, res: Response, next: NextFunction) => {
      try {
         const userId = req.userId
         if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: MESSAGES.USER_ID_REQUIRED })
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
               availablePrograms
            }
         });

      } catch (error) {
         next(error)
      }
   };