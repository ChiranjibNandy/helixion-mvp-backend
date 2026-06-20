import { Request, Response, NextFunction } from "express";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { getPendingEnrollmentsForStageRepo } from "../repositories/enrollment.repository.js";
import enrollmentModel from "../models/enrollment.model.js";
import { AppError } from "../utils/appError.js";
import {
   ENROLLMENT_STAGE,
   OSD_JUNIOR_ACTION,
   OSD_SENIOR_ACTION,
   REIMBURSEMENT_STATUS,
   ACTOR_TYPE,
} from "../constants/enum.js";
import { toObjectId } from "../utils/mongo.js";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/osd/pending
// ─────────────────────────────────────────────────────────────────────────────
export const getPendingEnrollments = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const orgId     = req.orgId!;
      const osdLevel  = req.officeRoles?.osd?.level ?? 1;

      const stage = osdLevel >= 2
         ? ENROLLMENT_STAGE.OSD_SENIOR_REVIEW
         : ENROLLMENT_STAGE.OSD_JUNIOR_REVIEW;

      const enrollments = await getPendingEnrollmentsForStageRepo(orgId, stage);

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
// PATCH /api/osd/enrollments/:id/junior-action  (OSD junior)
// ─────────────────────────────────────────────────────────────────────────────
export const takeOsdJuniorAction = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const { id }           = req.params;
      const officerId        = req.userId!;
      const orgId            = req.orgId!;
      const { action, note } = req.body;

      if (!Object.values(OSD_JUNIOR_ACTION).includes(action as any) || action === OSD_JUNIOR_ACTION.PENDING) {
         throw new AppError("Invalid action. Must be 'return' or 'recommend'.", HTTP_STATUS.BAD_REQUEST);
      }

      const enrollment = await enrollmentModel.findOne({
         _id:          toObjectId(String(id)),
         orgId:        toObjectId(orgId),
         currentStage: ENROLLMENT_STAGE.OSD_JUNIOR_REVIEW,
      });

      if (!enrollment) {
         throw new AppError(MESSAGES.ENROLLMENT_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      }

      if (!enrollment.reimbursement) {
         throw new AppError("No reimbursement data found.", HTTP_STATUS.CONFLICT);
      }

      enrollment.reimbursement.osdJunior = {
         officerId: toObjectId(officerId) as any,
         action:    action as OSD_JUNIOR_ACTION,
         note:      note || "",
         actedAt:   new Date(),
      };

      if (action === OSD_JUNIOR_ACTION.RETURN) {
         enrollment.currentStage = ENROLLMENT_STAGE.REIMBURSEMENT_SUBMITTED;
         enrollment.statusSummary.reimbursementStatus = REIMBURSEMENT_STATUS.RETURNED;
      } else {
         // recommend → escalate to senior
         enrollment.currentStage = ENROLLMENT_STAGE.OSD_SENIOR_REVIEW;
         enrollment.statusSummary.reimbursementStatus = REIMBURSEMENT_STATUS.RECOMMENDED;
      }

      enrollment.timeline.push({
         stage:     enrollment.currentStage,
         actorId:   toObjectId(officerId),
         actorType: ACTOR_TYPE.OSD,
         action,
         note:      note || "",
         at:        new Date(),
      });

      await enrollment.save();

      res.status(HTTP_STATUS.OK).json({
         success:      true,
         message:      `OSD junior action '${action}' recorded`,
         currentStage: enrollment.currentStage,
      });
   } catch (error) {
      next(error);
   }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/osd/enrollments/:id/senior-action  (OSD senior)
// ─────────────────────────────────────────────────────────────────────────────
export const takeOsdSeniorAction = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const { id }           = req.params;
      const officerId        = req.userId!;
      const orgId            = req.orgId!;
      const { action, note } = req.body;

      if (!Object.values(OSD_SENIOR_ACTION).includes(action as any) || action === OSD_SENIOR_ACTION.WAITING) {
         throw new AppError("Invalid action. Must be 'approve' or 'reject'.", HTTP_STATUS.BAD_REQUEST);
      }

      const enrollment = await enrollmentModel.findOne({
         _id:          toObjectId(String(id)),
         orgId:        toObjectId(orgId),
         currentStage: ENROLLMENT_STAGE.OSD_SENIOR_REVIEW,
      });

      if (!enrollment) {
         throw new AppError(MESSAGES.ENROLLMENT_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      }

      if (!enrollment.reimbursement) {
         throw new AppError("No reimbursement data found.", HTTP_STATUS.CONFLICT);
      }

      enrollment.reimbursement.osdSenior = {
         officerId: toObjectId(officerId) as any,
         action:    action as OSD_SENIOR_ACTION,
         note:      note || "",
         actedAt:   new Date(),
      };

      enrollment.currentStage = action === OSD_SENIOR_ACTION.APPROVE
         ? ENROLLMENT_STAGE.REIMBURSEMENT_APPROVED
         : ENROLLMENT_STAGE.OSD_JUNIOR_REVIEW; // send back to junior on reject

      enrollment.statusSummary.reimbursementStatus = action === OSD_SENIOR_ACTION.APPROVE
         ? REIMBURSEMENT_STATUS.APPROVED
         : REIMBURSEMENT_STATUS.REJECTED;

      enrollment.timeline.push({
         stage:     enrollment.currentStage,
         actorId:   toObjectId(officerId),
         actorType: ACTOR_TYPE.OSD,
         action,
         note:      note || "",
         at:        new Date(),
      });

      await enrollment.save();

      res.status(HTTP_STATUS.OK).json({
         success:      true,
         message:      `OSD senior action '${action}' recorded`,
         currentStage: enrollment.currentStage,
      });
   } catch (error) {
      next(error);
   }
};
