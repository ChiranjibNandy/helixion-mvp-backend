import { Request, Response, NextFunction } from "express";
import { ZodTypeAny } from "zod";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";

type ValidationSchema = {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
};

export const validate = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // BODY
      if (schema.body) {
        const result = schema.body.safeParse(req.body);

        if (!result.success) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            message: result.error.issues.map(
              (err) => err.message
            ),
            errors: MESSAGES.VALIDATION_FAILED,
          });
        }

        req.body = result.data;
      }

      // QUERY
      if (schema.query) {
        const result = schema.query.safeParse(req.query);

        if (!result.success) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            message: MESSAGES.VALIDATION_FAILED,
            errors: result.error.issues.map(
              (err) => err.message
            ),
          });
        }
      }

      // PARAMS
      if (schema.params) {
        const result = schema.params.safeParse(req.params);

        if (!result.success) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            message: MESSAGES.VALIDATION_FAILED,
            errors: result.error.issues.map(
              (err) => err.message
            ),
          });
        }
      }

      next();

    } catch (error) {
      next(error);
    }
  };
};