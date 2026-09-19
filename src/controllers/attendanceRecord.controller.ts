import { Request, Response, NextFunction } from "express";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { AppError } from "../utils/appError.js";
import {
   getProgramAttendanceGridService,
   markAttendanceDayService,
   updateAttendanceNotesService,
} from "../services/attendanceRecord.service.js";

export const getProgramAttendanceGridController = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const requestingUserId = req.userId;
      if (!requestingUserId) {
         throw new AppError(MESSAGES.USER_ID_REQUIRED, HTTP_STATUS.UNAUTHORIZED);
      }
      const { id: programId } = req.params;
      const { page, limit, search, sortBy, sortOrder } = req.query as unknown as {
         page: number;
         limit: number;
         search: string;
         sortBy?: string;
         sortOrder?: "asc" | "desc";
      };

      const data = await getProgramAttendanceGridService(String(programId), requestingUserId, {
         page,
         limit,
         search,
         sortBy,
         sortOrder,
      });

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.ATTENDANCE_GRID_FETCH_SUCCESS,
         data,
         timestamp: new Date().toISOString(),
      });
   } catch (error) {
      next(error);
   }
};

export const markAttendanceDayController = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const training_providerId = req.userId;
      if (!training_providerId) {
         throw new AppError(MESSAGES.USER_ID_REQUIRED, HTTP_STATUS.UNAUTHORIZED);
      }
      const { id: programId, enrollmentId } = req.params;
      const { date, status } = req.body;

      const data = await markAttendanceDayService({
         programId: String(programId),
         enrollmentId: String(enrollmentId),
         date,
         status,
         training_providerId,
      });

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.ATTENDANCE_DAY_SAVE_SUCCESS,
         data,
      });
   } catch (error) {
      next(error);
   }
};

export const updateAttendanceNotesController = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const training_providerId = req.userId;
      if (!training_providerId) {
         throw new AppError(MESSAGES.USER_ID_REQUIRED, HTTP_STATUS.UNAUTHORIZED);
      }
      const { id: programId, enrollmentId } = req.params;
      const { notes } = req.body;

      const data = await updateAttendanceNotesService({
         programId: String(programId),
         enrollmentId: String(enrollmentId),
         notes,
         training_providerId,
      });

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.ATTENDANCE_NOTES_SAVE_SUCCESS,
         data,
      });
   } catch (error) {
      next(error);
   }
};
