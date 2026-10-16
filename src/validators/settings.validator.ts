import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  SETTINGS_VALIDATION,
} from "../constants/settings.js";
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

const locationSchema = z
  .object({
    addressLine1: z.string().trim().min(1, MESSAGES.ADDRESS_LINE1_REQUIRED), 
    addressLine2: z.string().trim().optional(),
    city: z.string().trim().min(1, MESSAGES.CITY_REQUIRED),
    state: z.string().trim().min(1, MESSAGES.STATE_REQUIRED),
    postalCode: z.string().trim().min(1, MESSAGES.POSTAL_CODE_REQUIRED),
  })
  .strict()
  .optional();

const settingsUpdateSchema = z
  .object({
    gstNumber: gstNumberSchema,
    panNumber: panNumberSchema,
    location: locationSchema,
  })
  .strict()
  .refine(
    (data) =>
      data.gstNumber !== undefined ||
      data.panNumber !== undefined ||
      data.location !== undefined,
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
    const result = settingsUpdateSchema.safeParse(req.body);

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
