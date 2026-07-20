import { Request, Response, NextFunction } from "express";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import {
   getPendingEnrollmentsService,
   takeOsdSeniorActionService,
   takeOsdJuniorActionService,
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
         message: MESSAGES.PENDING_TOUR_APPROVALS_FETCHED,
         data:    enrollments,
         count:   enrollments.length,
      });
   } catch (error) {
      next(error);
   }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/osd/enrollments/:enrollmentId/junior-action
// ─────────────────────────────────────────────────────────────────────────────
export const takeOsdJuniorAction = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const enrollmentId      = String(req.params.enrollmentId);
      const officerId         = req.userId!;
      const orgId             = req.orgId!;
      const { action, note }  = req.body;

      const result = await takeOsdJuniorActionService(
         enrollmentId,
         officerId,
         orgId,
         action,
         note || ""
      );

      return res.status(HTTP_STATUS.OK).json({
         success:      true,
         message:      `OSD junior action '${action}' recorded`,
         currentStage: result.currentStage,
      });
   } catch (error) {
      next(error);
   }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/osd/enrollments/:enrollmentId/senior-action
// ─────────────────────────────────────────────────────────────────────────────
export const takeOsdSeniorAction = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const enrollmentId      = String(req.params.enrollmentId);
      const officerId         = req.userId!;
      const orgId             = req.orgId!;
      const { action, note }  = req.body;

      const result = await takeOsdSeniorActionService(
         enrollmentId,
         officerId,
         orgId,
         action,
         note || ""
      );

      return res.status(HTTP_STATUS.OK).json({
         success:      true,
         message:      `OSD senior action '${action}' recorded`,
         currentStage: result.currentStage,
      });
   } catch (error) {
      next(error);
   }
};
