import { Request, Response, NextFunction } from "express";
import { getProgramAttendanceService, takeAttendanceService, updateParticipantAttendanceService } from "../services/attendance.service.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { AppError } from "../utils/appError.js";


export const takeAttendanceController = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const training_providerId = req.userId
      if (!training_providerId) {
         throw new AppError(MESSAGES.USER_ID_REQUIRED, HTTP_STATUS.UNAUTHORIZED)
      }
      const programId = String(req.params.id);

      const { date, participants } = req.body;

      const attendance = await takeAttendanceService({
         programId,
         date,
         participants,
         training_providerId
      });

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.ATTENDANCE_SAVE_SUCCESS,
      });
   } catch (error) {
      next(error);
   }
};

//controller for fetching attendance data based on attendanceId 

export const getProgramAttendanceController = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const { id } = req.params;

      const attendanceData = await getProgramAttendanceService(String(id));

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.ATTENDANCE_FETCH_SUCCESS,
         data: attendanceData
      });
   } catch (error) {
      next(error);
   }
};

//take single attendance controller

export const updateParticipantAttendanceController =
   async (
      req: Request,
      res: Response,
      next: NextFunction
   ) => {
      try {
         const { id, pid } = req.params;

         const { date, present_status } = req.body;

         await updateParticipantAttendanceService({
            programId: String(id),
            participantId: String(pid),
            date,
            present_status
         });

         return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: MESSAGES.ATTENDANCE_SAVE_SUCCESS,
         });
      } catch (error) {
         next(error);
      }
   };