import { NextFunction, Request, Response } from "express";
import { addFeedbackService, getCompletedFeedbackProgramsService } from "../services/feedback.service.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";

export const getCompletedFeedbackPrograms = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const employeeId = req.userId;

      const programs =
         await getCompletedFeedbackProgramsService(
            String(employeeId)
         );

      res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.COMPLETED_PROGRAM_FETCH,
         data: programs,
      });
   } catch (error) {
      next(error);
   }
};


export const addFeedback = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const employeeId = req.userId
   
      const feedback = await addFeedbackService(
         String(employeeId),
         req.body
      );

      res.status(HTTP_STATUS.CREATED).json({
         success: true,
         message: MESSAGES.FEEDBACK_ADDED_SUCCESSFULLY,
         data: feedback,
      });
   } catch (error) {
      next(error);
   }
};