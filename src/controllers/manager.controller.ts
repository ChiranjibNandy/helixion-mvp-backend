import { Request, Response, NextFunction } from "express";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import {
   getPendingEnrollmentsService,
   takeManagerActionService,
   getPendingReimbursementsService,
   takeReimbursementManagerActionService,
   getManagerDashboardService,
} from "../services/manager.service.js";
import { getRelevantEnrollmentService } from "../services/enrollment.service.js";
import { MESSAGES } from "../constants/messages.js";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/manager/dashboard
// ─────────────────────────────────────────────────────────────────────────────
export const getManagerDashboard = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const managerId = req.userId!;
      const orgId     = req.orgId!;

      const dashboard = await getManagerDashboardService(managerId, orgId);

      res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.DASHBOARD_DATA_FETCH,
         data:    dashboard,
      });
   } catch (error) {
      next(error);
   }
};

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
      const orgId = req.orgId!;
      const level = req.query.level !== "0" ? 1 : undefined;

      const enrollments = await getPendingEnrollmentsService(managerId, orgId, level);

      res.status(HTTP_STATUS.OK).json({
         success: true,
         data: enrollments,
         count: enrollments.length,
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
      const id = String(req.params.id);
      const managerId = req.userId!;
      const orgId = req.orgId!;
      const { action, note } = req.body;

      const result = await takeManagerActionService(
         id,
         managerId,
         orgId,
         action,
         note || ""
      );

      res.status(HTTP_STATUS.OK).json({
         success: true,
         message: `Action '${ action }' recorded`,
         currentStage: result.currentStage,
      });
   } catch (error) {
      next(error);
   }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/manager/enrollments
// ─────────────────────────────────────────────────────────────────────────────

export const getRelevantEnrollments = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const managerId = req.userId!;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const search = String(req.query.search || "").trim();

      const enrollments = await getRelevantEnrollmentService({ managerId, page, limit, search, });

      res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.ENROLLMENT_DATA_FETCH,
         data: enrollments,
      })
   } catch (error) {
      next(error)
   }
}
// GET /api/manager/reimbursements/pending
// ─────────────────────────────────────────────────────────────────────────────
export const getPendingReimbursements = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const managerId = req.userId!;
      const orgId = req.orgId!;

      const enrollments = await getPendingReimbursementsService(managerId, orgId);

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
// PATCH /api/manager/enrollments/:enrollmentId/reimbursement-action
// ─────────────────────────────────────────────────────────────────────────────
export const takeReimbursementManagerAction = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const enrollmentId = String(req.params.enrollmentId);
      const managerId = req.userId!;
      const orgId = req.orgId!;
      const { action, note } = req.body;

      const result = await takeReimbursementManagerActionService(
         enrollmentId,
         managerId,
         orgId,
         action,
         note || ""
      );

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: `Action '${ action }' recorded`,
         currentStage: result.currentStage,
      });
   } catch (error) {
      next(error);
   }
};
