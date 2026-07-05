import { Request, Response, NextFunction } from "express";
import { getProgramParticipantsService, getPublishedProgramsService } from "../services/program.service.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { AppError } from "../utils/appError.js";

export const searchPublishedProgramsController = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const userId = req.userId;
      if (!userId) {
         throw new AppError(MESSAGES.USER_ID_REQUIRED, HTTP_STATUS.UNAUTHORIZED)
      }

      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;

      const result = await getPublishedProgramsService({
         userId,
         page,
         limit,
      });

      res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.PUBLISHED_PROGRAM_FETCH,
         data: result,
      });
   } catch (error) {
      next(error);
   }
};


export const getProgramParticipantsController = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const requestingUserId = req.userId;
      if (!requestingUserId) {
         throw new AppError(MESSAGES.USER_ID_REQUIRED, HTTP_STATUS.UNAUTHORIZED);
      }
      const { id } = req.params;

      const participants =
         await getProgramParticipantsService(String(id), requestingUserId);

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.PARTICIPANT_FETCH,
         data: participants
      });
   } catch (error) {
      next(error);
   }
};