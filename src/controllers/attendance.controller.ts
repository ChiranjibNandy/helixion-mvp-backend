import { Request, Response, NextFunction } from "express";
import { takeAttendanceService } from "../services/attendance.service.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";


export const takeAttendanceController = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const programId = String(req.params.id);

      const { date, participants } = req.body;

      const attendance = await takeAttendanceService({
         programId,
         date,
         participants,
      });

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.ATTENDANCE_SAVE_SUCCESS,
         data: attendance,
      });
   } catch (error) {
      next(error);
   }
};