import { Request, Response, NextFunction } from "express";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";

export const errorMiddleware = (
   err: Error,
   req: Request,
   res: Response,
   next: NextFunction
) => {
   res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      message: err.message || MESSAGES.INTERNAL_SERVER_ERROR
   });

};