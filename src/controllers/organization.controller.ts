import { NextFunction, Request, Response } from "express";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import {  bulkUploadOrganizationService, createOrganizationService, getOrganizationByIdService, getOrganizationsService, getOrganizationStatusService, updateOrganizationDetailsService, updateOrganizationPolicyService } from "../services/organization.service.js";
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

export const getOrganizations = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const search = (req.query.search as string) || "";

      const result = await getOrganizationsService(page, limit, search, req.userId!);

      res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.ORGANIZATIONS_FETCHED,
         ...result,
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
         req.body,
         req.userId!
      );
      res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.POLICY_UPDATE
      });
   } catch (error) {
      next(error)
   }
};

export const getOrganizationById = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const { organizationId } = req.params;
      const data = await getOrganizationByIdService(String(organizationId), req.userId!);
      res.status(HTTP_STATUS.OK).json({
         success: true,
         data
      });
   } catch (error) {
      next(error);
   }
};

export const updateOrganizationDetails = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const { organizationId } = req.params;
      const data = await updateOrganizationDetailsService(String(organizationId), req.body, req.userId!);
      res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.ORG_DETAILS_UPDATED,
         data
      });
   } catch (error) {
      next(error);
   }
};