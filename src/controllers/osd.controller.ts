import { Request, Response, NextFunction } from "express";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import {
   getPendingEnrollmentsService,
   takeOsdJuniorActionService,
   takeOsdSeniorActionService,
   takeTourOsdActionService,
} from "../services/osd.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/osd/reimbursements/pending
// ─────────────────────────────────────────────────────────────────────────────
export const getPendingEnrollments = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const orgId = req.orgId!;

      const enrollments = await getPendingEnrollmentsService(orgId);

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         data:    enrollments,
         count:   enrollments.length,
      });
   } catch (error) {
      next(error);
   }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/osd/enrollments/:enrollmentId/reimbursement-action
// ─────────────────────────────────────────────────────────────────────────────
export const takeReimbursementOsdAction = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const enrollmentId      = String(req.params.enrollmentId);
      const officerId         = req.userId!;
      const orgId             = req.orgId!;
      const { action, note }  = req.body;

      const result = await takeReimbursementOsdActionService(
         enrollmentId,
         officerId,
         orgId,
         action,
         note || ""
      );

      return res.status(HTTP_STATUS.OK).json({
         success:      true,
         message:      `OSD action '${action}' recorded`,
         currentStage: result.currentStage,
      });
   } catch (error) {
      next(error);
   }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/osd/enrollments/:id/tour-action  (OSD tour approval)
// ─────────────────────────────────────────────────────────────────────────────
export const takeTourOsdAction = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const id               = String(req.params.id);
      const officerId        = req.userId!;
      const orgId            = req.orgId!;
      const { action, note } = req.body;

      const result = await takeTourOsdActionService(
         id,
         officerId,
         orgId,
         action,
         note || ""
      );

      res.status(HTTP_STATUS.OK).json({
         success:      true,
         message:      `OSD tour action '${action}' recorded`,
         currentStage: result.currentStage,
      });
   } catch (error) {
      next(error);
   }
};