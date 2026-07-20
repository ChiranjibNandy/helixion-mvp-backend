import { Request, Response, NextFunction } from "express";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import {
   getPendingEnrollmentsService,
   takeJuniorActionService,
   takeSeniorActionService,
   getPendingTourCtdApprovalsService,
   takeTourCtdActionService,
} from "../services/trainingDept.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/training-dept/pending
// ─────────────────────────────────────────────────────────────────────────────
export const getPendingEnrollments = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const orgId = req.orgId!;

      const enrollments = await getPendingEnrollmentsService(orgId);

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
// PATCH /api/training-dept/enrollments/:id/junior-action  (junior only)
// ─────────────────────────────────────────────────────────────────────────────
export const takeJuniorAction = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const id               = String(req.params.id);
      const officerId        = req.userId!;
      const orgId            = req.orgId!;
      const { action, note } = req.body;

      const result = await takeJuniorActionService(
         id,
         officerId,
         orgId,
         action,
         note || ""
      );

      res.status(HTTP_STATUS.OK).json({
         success: true,
         message: result.message,
      });
   } catch (error) {
      next(error);
   }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/training-dept/enrollments/:id/senior-action  (senior only)
// ─────────────────────────────────────────────────────────────────────────────
export const takeSeniorAction = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const id               = String(req.params.id);
      const officerId        = req.userId!;
      const orgId            = req.orgId!;
      const { action, note } = req.body;

      const result = await takeSeniorActionService(
         id,
         officerId,
         orgId,
         action,
         note || ""
      );

      res.status(HTTP_STATUS.OK).json({
         success:      true,
         message:      `Senior action '${action}' recorded`,
         currentStage: result.currentStage,
      });
   } catch (error) {
      next(error);
   }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/training-dept/tour-approvals/pending
// ─────────────────────────────────────────────────────────────────────────────
export const getPendingTourApprovals = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const orgId = req.orgId!;

      const enrollments = await getPendingTourCtdApprovalsService(orgId);

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         data: enrollments,
         count: enrollments.length,
      });
   } catch (error) {
      next(error);
   }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/training-dept/enrollments/:id/tour-action  (CTD tour approval)
// ─────────────────────────────────────────────────────────────────────────────
export const takeTourAction = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const id               = String(req.params.id);
      const officerId        = req.userId!;
      const orgId            = req.orgId!;
      const { action, note } = req.body;

      const result = await takeTourCtdActionService(
         id,
         officerId,
         orgId,
         action,
         note || ""
      );

      res.status(HTTP_STATUS.OK).json({
         success:      true,
         message:      `Training Dept tour action '${action}' recorded`,
         currentStage: result.currentStage,
      });
   } catch (error) {
      next(error);
   }
};
