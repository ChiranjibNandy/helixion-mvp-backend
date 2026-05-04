import { NextFunction, Request, Response } from "express";
import { createProgramService } from "../services/training_provider.service.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";


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