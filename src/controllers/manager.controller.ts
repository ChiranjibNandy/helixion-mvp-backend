import { Request, Response, NextFunction } from "express";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import {
   getPendingEnrollmentsService,
   takeManagerActionService,
} from "../services/manager.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/manager/pending
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Returns enrollments waiting for this manager's action.
 *
 * Query param:
 *   - level=1  → only direct reports (default)
 *   - level=0  → all levels this manager is in the chain for
 */
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
/**
 * Manager takes an action on an enrollment.
 *
 * Body:
 *   - action: "recommend" | "approve" | "reject"
 *   - note: string (optional)
 */
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
