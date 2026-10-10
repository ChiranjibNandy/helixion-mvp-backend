import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  SETTINGS_VALIDATION,
} from "../constants/settings.js";
import { ORG_ROLE } from "../constants/enum.js";
import { MESSAGES } from "../constants/messages.js";
import { AppError } from "../utils/appError.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

const gstNumberSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine(
    (value) =>
      value === "" ||
      (
        value.length === SETTINGS_VALIDATION.GST_NUMBER_MAX_LENGTH &&
        SETTINGS_VALIDATION.GST_NUMBER_REGEX.test(value)
      ),
    { message: MESSAGES.GST_NUMBER_INVALID }
  )
  .optional();

const panNumberSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine(
    (value) =>
      value === "" ||
      (
        value.length === SETTINGS_VALIDATION.PAN_NUMBER_MAX_LENGTH &&
        SETTINGS_VALIDATION.PAN_NUMBER_REGEX.test(value)
      ),
    { message: MESSAGES.PAN_NUMBER_INVALID }
  )
  .optional();

const commonSettingsSchema = z.object({
  gstNumber: gstNumberSchema,
  panNumber: panNumberSchema,
});

const corporateSettingsSchema = commonSettingsSchema
  .extend({})
  .strict()
  .refine(
    (data) =>
      data.gstNumber !== undefined ||
      data.panNumber !== undefined,
    {
      message: MESSAGES.ATLEAST_PROVIDE_ONE_SETTING_FIELD,
    }
  );

const trainingProviderSettingsSchema = commonSettingsSchema
  .extend({})
  .strict()
  .refine(
    (data) =>
      data.gstNumber !== undefined ||
      data.panNumber !== undefined,
    {
      message: MESSAGES.ATLEAST_PROVIDE_ONE_SETTING_FIELD,
    }
  );

export const getSettingsUpdateSchema = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    let schema: z.ZodType;

    switch (req.orgRole) {
      case ORG_ROLE.ADMIN:
        schema = corporateSettingsSchema;
        break;

      case ORG_ROLE.TRAINING_PROVIDER:
        schema = trainingProviderSettingsSchema;
        break;

      default:
        return next(
          new AppError(
            MESSAGES.UNSUPPORTED_SETTING_PROFILE_TYPE,
            HTTP_STATUS.BAD_REQUEST
          )
        );
    }

    const result = schema.safeParse(req.body);

    if (!result.success) {
      const message = result.error.issues
        .map((issue) => issue.message)
        .join(", ");

      return next(
        new AppError(message, HTTP_STATUS.BAD_REQUEST)
      );
    }

    req.body = result.data;
    next();
  } catch (error) {
    next(error);
  }
};
