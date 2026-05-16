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
   console.error("ERROR CAUGHT IN MIDDLEWARE:", err);

   let statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;

   if (
      err.message === MESSAGES.USER_NOT_FOUND ||
      err.message === MESSAGES.INVALID_CREDENTIALS ||
      err.message === MESSAGES.NOT_APPROVED ||
      err.message === MESSAGES.USER_ALREADY_EXISTS
   ) {
      statusCode = HTTP_STATUS.UNAUTHORIZED;
   }

   res.status(statusCode).json({
      message: err.message || MESSAGES.INTERNAL_SERVER_ERROR
   });
};