import { Request, Response, NextFunction } from "express";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import {
   getPendingEnrollmentsForManagerRepo,
} from "../repositories/enrollment.repository.js";
import enrollmentModel from "../models/enrollment.model.js";
import { AppError } from "../utils/appError.js";
import { MANAGER_ACTION, MANAGER_CHAIN_STATUS, ENROLLMENT_STAGE, ACTOR_TYPE } from "../constants/enum.js";
import { toObjectId } from "../utils/mongo.js";

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

      const enrollments = await getPendingEnrollmentsForManagerRepo(
         managerId,
         orgId,
         level !== undefined ? { level } : {}
      );

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
      const { id }             = req.params;
      const managerId          = req.userId!;
      const orgId              = req.orgId!;
      const { action, note }   = req.body;

      if (!Object.values(MANAGER_ACTION).includes(action) || action === MANAGER_ACTION.PENDING) {
         throw new AppError("Invalid action. Must be recommend, approve, or reject.", HTTP_STATUS.BAD_REQUEST);
      }

      const enrollment = await enrollmentModel.findOne({
         _id:   toObjectId(String(id)),
         orgId: toObjectId(orgId),
         managerChain: {
            $elemMatch: {
               userId: toObjectId(managerId),
               status: MANAGER_CHAIN_STATUS.PENDING,
            },
         },
      });

      if (!enrollment) {
         throw new AppError(MESSAGES.ENROLLMENT_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      }

      // Update the specific chain entry for this manager
      const chainEntry = enrollment.managerChain.find(
         (e) => e.userId.toString() === managerId
      );

      if (!chainEntry) {
         throw new AppError(MESSAGES.ACCESS_DENIED, HTTP_STATUS.FORBIDDEN);
      }

      (chainEntry as any).status = action === MANAGER_ACTION.REJECT
         ? MANAGER_CHAIN_STATUS.REJECTED
         : MANAGER_CHAIN_STATUS.APPROVED;

      // Update top-level managerApproval
      enrollment.managerApproval.action   = action as MANAGER_ACTION;
      enrollment.managerApproval.note     = note || "";
      enrollment.managerApproval.actedAt  = new Date();

      // Determine next stage
      if (action === MANAGER_ACTION.REJECT) {
         enrollment.currentStage = ENROLLMENT_STAGE.REJECTED;
         enrollment.statusSummary.enrollmentStatus = "rejected";
      } else {
         // Check if all required levels have approved per policySnapshot
         const minLevel = enrollment.policySnapshot?.managerApproval?.minLevelToApprove ?? 1;
         const approvedLevels = enrollment.managerChain.filter(
            (e) => (e as any).status === MANAGER_CHAIN_STATUS.APPROVED
         ).map((e) => e.level);

         const lowestApproved = Math.min(...approvedLevels);

         if (lowestApproved <= minLevel) {
            // Minimum required level approved — move to training dept review
            enrollment.currentStage = ENROLLMENT_STAGE.TRAINING_DEPT_REVIEW;
            enrollment.statusSummary.enrollmentStatus = "recommended";
         }

         // Activate next waiting level if not yet fully approved
         const nextWaiting = enrollment.managerChain
            .filter((e) => (e as any).status === MANAGER_CHAIN_STATUS.WAITING)
            .sort((a, b) => a.level - b.level)[0];

         if (nextWaiting) {
            (nextWaiting as any).status = MANAGER_CHAIN_STATUS.PENDING;
         }
      }

      // Append to timeline
      enrollment.timeline.push({
         stage:     enrollment.currentStage,
         actorId:   toObjectId(managerId),
         actorType: ACTOR_TYPE.MANAGER,
         action,
         note:      note || "",
         at:        new Date(),
      });

      await enrollment.save();

      res.status(HTTP_STATUS.OK).json({
         success:      true,
         message:      `Action '${action}' recorded`,
         currentStage: enrollment.currentStage,
      });
   } catch (error) {
      next(error);
   }
};
