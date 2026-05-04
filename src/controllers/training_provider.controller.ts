import { NextFunction, Request, Response } from "express";
import { bulkCreateProgramService, createProgramService } from "../services/training_provider.service.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { AppError } from "../utils/appError.js";


export const createProgram = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const file = req.file;
      const program = await createProgramService({ ...req.body, training_providerId: req.userId, file });

      return res.status(HTTP_STATUS.CREATED).json({
         success: true,
         message: MESSAGES.PROGRAM_CREATED,
         data: program,
      });
   } catch (error) {
      next(error)
   }
};

// bulk create program controller

export const bulkCreateProgram = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      if (!req.file) {
         return new AppError(MESSAGES.CSV_REQUIRED, HTTP_STATUS.BAD_REQUEST)
      }

      const result = await bulkCreateProgramService({
         file: req.file,
         training_providerId: req.userId,
      });

      return res.status(HTTP_STATUS.CREATED).json({
         success: true,
         message: MESSAGES.PROGRAM_CREATED,
         data: result,
      });
   } catch (error) {
      next(error);
   }
};