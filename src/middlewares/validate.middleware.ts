import { Request, Response, NextFunction } from "express";
import { ZodTypeAny, z } from "zod";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";

export const validate = (schema: ZodTypeAny) => {
   return (req: Request, res: Response, next: NextFunction) => {

      const result = schema.safeParse(req.body);

      if (!result.success) {
         const formattedError = z.treeifyError(result.error);

         return res.status(HTTP_STATUS.BAD_REQUEST).json({
            message: MESSAGES.VALIDATION_FAILED,
            errors: formattedError
         });
      }

      req.body = result.data;

      next();
   };
};