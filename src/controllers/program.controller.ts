import { Request, Response, NextFunction } from "express";
import { getPublishedProgramsService } from "../services/program.service.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";

export const getPublishedProgramsController = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const userId = req.userId;

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