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
      let ownerId = null;
      const role = req.orgRole
      if (role == ORG_ROLE.TRAINING_PROVIDER) {
         ownerId = req.userId
      } else {
         ownerId = req.orgId
      }

      if (!ownerId) {
         return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            message: MESSAGES.ACCESS_DENIED,
         });
      }

      const profile = await getSettingsProfileService(
         ownerId
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
      let ownerId = null;
      const role = req.orgRole
      if (role == ORG_ROLE.TRAINING_PROVIDER) {
         ownerId = req.userId
      } else {
         ownerId = req.orgId
      }
      const profileType = req.orgRole as ProfileType;
      if (!ownerId) {
         return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            message: MESSAGES.ACCESS_DENIED,
         });
      }
      if (!profileType) {
         return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: MESSAGES.PROFILE_TYPE_REQUIRED,
         });
      }
      const profile = await updateSettingsProfileService({
         ownerId,
         profileType,
         ...req.body,
      });
      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.SETTINGS_PROFILE_UPDATED,
         profile
      });
   } catch (error) {
      next(error);
   }
};
