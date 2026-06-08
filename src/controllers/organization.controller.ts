import { Request, Response, NextFunction } from "express";
import { createOrganizationService, updatePolicyService } from "../services/organization.service.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";

export const createOrganization = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      await createOrganizationService(
         req.body
      );

      res.status(HTTP_STATUS.CREATED).json({
         success: true,
         message: MESSAGES.ORG_CREATE
      });
   } catch (error) {
      next(error);
   }
};

export const updatePolicy = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      await updatePolicyService(
         String(req.params.id),
         req.body.policy
      );

      res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.POLICY_UPDATE
      });
   } catch (error) {
      next(error);
   }
};