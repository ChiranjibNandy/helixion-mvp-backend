import { Request, Response, NextFunction } from "express";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { getPendingEnrollmentsForStageRepo } from "../repositories/enrollment.repository.js";
import enrollmentModel from "../models/enrollment.model.js";
import { AppError } from "../utils/appError.js";
import {
   ENROLLMENT_STAGE,
   TRAINING_DEPT_JUNIOR_ACTION,
   TRAINING_DEPT_SENIOR_ACTION,
   ACTOR_TYPE,
} from "../constants/enum.js";
import { toObjectId } from "../utils/mongo.js";

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

      const enrollments = await getPendingEnrollmentsForStageRepo(
         orgId,
         ENROLLMENT_STAGE.TRAINING_DEPT_REVIEW
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
// PATCH /api/training-dept/enrollments/:id/junior-action  (junior only)
// ─────────────────────────────────────────────────────────────────────────────
export const takeJuniorAction = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const { id }           = req.params;
      const officerId        = req.userId!;
      const orgId            = req.orgId!;
      const { action, note } = req.body;

      if (!Object.values(TRAINING_DEPT_JUNIOR_ACTION).includes(action as any) || action === TRAINING_DEPT_JUNIOR_ACTION.PENDING) {
         throw new AppError("Invalid action. Junior action must be 'reviewed'.", HTTP_STATUS.BAD_REQUEST);
      }

      const enrollment = await enrollmentModel.findOne({
         _id:          toObjectId(String(id)),
         orgId:        toObjectId(orgId),
         currentStage: ENROLLMENT_STAGE.TRAINING_DEPT_REVIEW,
      });

      if (!enrollment) {
         throw new AppError(MESSAGES.ENROLLMENT_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      }

      if (!enrollment.trainingDeptReview) {
         enrollment.trainingDeptReview = {
            juniorOfficerId: toObjectId(officerId),
            juniorAction:    TRAINING_DEPT_JUNIOR_ACTION.PENDING,
            seniorAction:    TRAINING_DEPT_SENIOR_ACTION.WAITING,
         } as any;
      }

      (enrollment.trainingDeptReview as any).juniorOfficerId = toObjectId(officerId);
      (enrollment.trainingDeptReview as any).juniorAction    = action;
      (enrollment.trainingDeptReview as any).juniorNote      = note || "";
      (enrollment.trainingDeptReview as any).juniorActedAt   = new Date();

      enrollment.timeline.push({
         stage:     ENROLLMENT_STAGE.TRAINING_DEPT_REVIEW,
         actorId:   toObjectId(officerId),
         actorType: ACTOR_TYPE.TRAINING_DEPT,
         action,
         note:      note || "",
         at:        new Date(),
      });

      await enrollment.save();

      res.status(HTTP_STATUS.OK).json({
         success: true,
         message: "Junior review recorded",
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
      const { id }           = req.params;
      const officerId        = req.userId!;
      const orgId            = req.orgId!;
      const { action, note } = req.body;

      if (!Object.values(TRAINING_DEPT_SENIOR_ACTION).includes(action as any) || action === TRAINING_DEPT_SENIOR_ACTION.WAITING) {
         throw new AppError("Invalid action. Senior action must be 'approve' or 'reject'.", HTTP_STATUS.BAD_REQUEST);
      }

      const enrollment = await enrollmentModel.findOne({
         _id:          toObjectId(String(id)),
         orgId:        toObjectId(orgId),
         currentStage: ENROLLMENT_STAGE.TRAINING_DEPT_REVIEW,
      });

      if (!enrollment) {
         throw new AppError(MESSAGES.ENROLLMENT_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      }

      if (!enrollment.trainingDeptReview) {
         throw new AppError("Junior review must be completed first.", HTTP_STATUS.CONFLICT);
      }

      (enrollment.trainingDeptReview as any).seniorOfficerId = toObjectId(officerId);
      (enrollment.trainingDeptReview as any).seniorAction    = action;
      (enrollment.trainingDeptReview as any).seniorNote      = note || "";
      (enrollment.trainingDeptReview as any).seniorActedAt   = new Date();

      // Advance stage
      enrollment.currentStage = action === TRAINING_DEPT_SENIOR_ACTION.APPROVE
         ? ENROLLMENT_STAGE.APPROVED
         : ENROLLMENT_STAGE.REJECTED;

      enrollment.statusSummary.enrollmentStatus = action === TRAINING_DEPT_SENIOR_ACTION.APPROVE
         ? "approved"
         : "rejected";

      enrollment.timeline.push({
         stage:     enrollment.currentStage,
         actorId:   toObjectId(officerId),
         actorType: ACTOR_TYPE.TRAINING_DEPT,
         action,
         note:      note || "",
         at:        new Date(),
      });

      await enrollment.save();

      res.status(HTTP_STATUS.OK).json({
         success:      true,
         message:      `Senior action '${action}' recorded`,
         currentStage: enrollment.currentStage,
      });
   } catch (error) {
      next(error);
   }
};
