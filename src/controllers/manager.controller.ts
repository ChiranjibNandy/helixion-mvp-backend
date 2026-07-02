import { Request, Response, NextFunction } from "express";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import {
   getPendingEnrollmentsService,
   takeManagerActionService,
   getPendingReimbursementsService,
   takeReimbursementManagerActionService,
} from "../services/manager.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/manager/pending
// ─────────────────────────────────────────────────────────────────────────────
export const getPendingEnrollments = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const managerId = req.userId!;
      const orgId     = req.orgId!;
      const level     = req.query.level !== "0" ? 1 : undefined;

      const enrollments = await getPendingEnrollmentsService(managerId, orgId, level);

      res.status(HTTP_STATUS.OK).json({
         success: true,
         data:    enrollments,
         count:   enrollments.length,
      });
   } catch (error) {
      next(error);
   }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/manager/enrollments/:id/action
// ─────────────────────────────────────────────────────────────────────────────
export const takeManagerAction = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const id             = String(req.params.id);
      const managerId        = req.userId!;
      const orgId            = req.orgId!;
      const { action, note } = req.body;

      const result = await takeManagerActionService(
         id,
         managerId,
         orgId,
         action,
         note || ""
      );

      res.status(HTTP_STATUS.OK).json({
         success:      true,
         message:      `Action '${action}' recorded`,
         currentStage: result.currentStage,
      });
   } catch (error) {
      next(error);
   }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/manager/reimbursements/pending
// ─────────────────────────────────────────────────────────────────────────────
export const getPendingReimbursements = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const managerId = req.userId!;
      const orgId     = req.orgId!;

      const enrollments = await getPendingReimbursementsService(managerId, orgId);

      res.status(HTTP_STATUS.OK).json({
         success: true,
         data:    enrollments,
         count:   enrollments.length,
      });
   } catch (error) {
      next(error);
   }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/manager/enrollments/:id/reimbursement-action
// ─────────────────────────────────────────────────────────────────────────────
export const takeReimbursementManagerAction = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const id                = String(req.params.id);
      const managerId         = req.userId!;
      const orgId             = req.orgId!;
      const { action, note }  = req.body;

      const result = await takeReimbursementManagerActionService(
         id,
         managerId,
         orgId,
         action,
         note || ""
      );

      res.status(HTTP_STATUS.OK).json({
         success:      true,
         message:      `Action '${action}' recorded`,
         currentStage: result.currentStage,
      });
   } catch (error) {
      next(error);
   }
};
