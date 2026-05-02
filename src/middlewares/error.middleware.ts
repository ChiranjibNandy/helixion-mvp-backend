import { Request, Response, NextFunction } from "express";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { AppError } from "../utils/appError.js";

export const errorMiddleware = (
   err: AppError,
   req: Request,
   res: Response,
   next: NextFunction
) => {

   const statusCode =
      err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;

   res.status(statusCode).json({
      success: false,
      message: err.message || MESSAGES.INTERNAL_SERVER_ERROR
   });
};