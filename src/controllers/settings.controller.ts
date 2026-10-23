import { Request, Response, NextFunction } from "express";
import { ProfileType } from "../constants/settings.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import {
   getSettingsProfileService,
   updateSettingsProfileService,
} from "../services/settings.service.js";
import { ORG_ROLE } from "../constants/enum.js";

export const getSettingsProfile = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {

      const ownerId = req.userId
      const orgRole = req.orgRole as ProfileType;

      if (!ownerId) {
         return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: MESSAGES.SETTINGS_PROFILE_FETCHED,
            profile:{}
         });
      }

      const profile = await getSettingsProfileService(
         ownerId,
         orgRole
      );

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.SETTINGS_PROFILE_FETCHED,
         profile
      });
   } catch (error) {
      next(error);
   }
};

export const updateSettingsProfile = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const role = req.orgRole;

      const ownerId =
         role === ORG_ROLE.TRAINING_PROVIDER
            ? req.userId
            : req.orgId;

      if (!ownerId) {
         return res.status(HTTP_STATUS.FORBIDDEN).json({
            success: false,
            message: MESSAGES.ACCESS_DENIED,
         });
      }
      const profileType = req.orgRole as ProfileType;
      if (!profileType) {
         return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: MESSAGES.PROFILE_TYPE_REQUIRED,
         });
      }
       await updateSettingsProfileService({
         ownerId,
         profileType,
         ...req.body,
      });
      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.SETTINGS_PROFILE_UPDATED,
      });
   } catch (error) {
      next(error);
   }
};
