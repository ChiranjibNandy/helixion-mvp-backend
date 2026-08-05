import { NextFunction, Request, Response } from "express";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import {  bulkUploadOrganizationService, createOrganizationService, getOrganizationStatusService, updateOrganizationPolicyService } from "../services/organization.service.js";
import { MESSAGES } from "../constants/messages.js";
import { AppError } from "../utils/appError.js";

export const createOrganization = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      await createOrganizationService(
         req.body,
         req.userId!
      );
      res.status(HTTP_STATUS.CREATED).json({
         success: true,
         message: MESSAGES.ORG_CREATE
      });
   } catch (error) {
      next(error)
   }
};

export const bulkUploadOrganizations = async (req: Request, res: Response, next: NextFunction) => {
   try {
      if (!req.file) {
         throw new AppError(MESSAGES.CSV_REQUIRED, HTTP_STATUS.BAD_REQUEST);
      }

      await bulkUploadOrganizationService(
         req.file,
      );

      return res.status(HTTP_STATUS.CREATED).json({
         success: true,
         message: MESSAGES.ORG_BULK_UPLOAD_SUCCESS
      });
   } catch (error) {
      next(error);
   }
}

export const getOrganizationStatus = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const data = await getOrganizationStatusService(req.userId!);
      res.status(HTTP_STATUS.OK).json({
         success: true,
         data
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
      const { organizationId } = req.params;

      await updateOrganizationPolicyService(
         String(organizationId),
         req.body.policy
      );
      res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.POLICY_UPDATE
      });
   } catch (error) {
      next(error)
   }
};