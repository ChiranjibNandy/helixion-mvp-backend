import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import {
   getPendingEnrollmentsForStageRepo,
   getPendingTourApprovalsForCtdRepo,
} from "../repositories/enrollment.repository.js";
import enrollmentModel from "../models/enrollment.model.js";
import { AppError } from "../utils/appError.js";
import {
   ENROLLMENT_STAGE,
   TRAINING_DEPT_JUNIOR_ACTION,
   TRAINING_DEPT_SENIOR_ACTION,
   ACTOR_TYPE,
   TRAVEL_TYPE,
   TOUR_STATUS,
   TOUR_CTD_ACTION,
} from "../constants/enum.js";
import { toObjectId } from "../utils/mongo.js";
import {
   sendEnrollmentApprovedLocalMail,
   sendEnrollmentApprovedOutstationMail,
   sendEnrollmentRejectedByTrainingDeptMail,
   sendTravelRequestApprovedMail,
   sendTravelRequestNotApprovedByCtdMail,
} from "../utils/sendMail.js";
import { isLocalTraining, loadNotificationContext, logMailFailure } from "../utils/notification.util.js";

// ─────────────────────────────────────────────────────────────────────────────
// Get pending enrollments for Training Dept queue
// ─────────────────────────────────────────────────────────────────────────────

export const getPendingEnrollmentsService = async (orgId: string) => {
   return await getPendingEnrollmentsForStageRepo(
      orgId,
      ENROLLMENT_STAGE.TRAINING_DEPT_REVIEW
   );
};

// ─────────────────────────────────────────────────────────────────────────────
// Training Dept Junior action ("reviewed")
//
// Idempotency: stage filter on TRAINING_DEPT_REVIEW ensures a second call after
// the senior has already advanced the stage returns a 404 — no double-act.
// Idempotency within the junior step itself: if juniorAction is already
// "reviewed", we reject with 409 to prevent overwriting existing review data.
//
// Atomicity: single findOneAndUpdate — no read-modify-write race condition.
// ─────────────────────────────────────────────────────────────────────────────

export const takeJuniorActionService = async (
   enrollmentId: string,
   officerId: string,
   orgId: string,
   action: string,
   note: string
) => {
   // 1. Validate action
   if (
      !Object.values(TRAINING_DEPT_JUNIOR_ACTION).includes(
         action as TRAINING_DEPT_JUNIOR_ACTION
      ) ||
      action === TRAINING_DEPT_JUNIOR_ACTION.PENDING
   ) {
      throw new AppError(
         "Invalid action. Junior action must be 'reviewed'.",
         HTTP_STATUS.BAD_REQUEST
      );
   }

   // 2. Load enrollment to check idempotency (junior already reviewed?)
   const existing = await enrollmentModel.findOne({
      _id:          toObjectId(String(enrollmentId)),
      orgId:        toObjectId(orgId),
      currentStage: ENROLLMENT_STAGE.TRAINING_DEPT_REVIEW,
   });

   if (!existing) {
      throw new AppError(MESSAGES.ENROLLMENT_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   // Idempotency guard: reject if junior has already acted
   if (
      (existing.trainingDeptReview as any)?.juniorAction ===
      TRAINING_DEPT_JUNIOR_ACTION.REVIEWED
   ) {
      throw new AppError(
         "Junior review has already been recorded for this enrollment.",
         HTTP_STATUS.CONFLICT
      );
   }

   // 3. Atomic update — single round-trip, no race condition
   //    Stage does NOT advance here; it stays TRAINING_DEPT_REVIEW until senior acts.
   //
   // Timeline note: junior and senior actions both write actorType
   // TRAINING_DEPT with a bare action string from two DIFFERENT enums
   // (TRAINING_DEPT_JUNIOR_ACTION here, TRAINING_DEPT_SENIOR_ACTION below).
   // This is safe today only because TRAINING_DEPT_JUNIOR_ACTION's sole
   // writable value ("reviewed") never collides with the senior's
   // ("approve"/"reject") — the same actorType-sharing pattern that caused
   // a real notification-misclassification bug between manager/reimbursement
   // actions (see TIMELINE_ACTION in enum.ts). If a junior action ever gains
   // an "approve"/"reject"-shaped value, give it a distinct TIMELINE_ACTION
   // member the same way, instead of reusing the enum's raw value.
   await enrollmentModel.findOneAndUpdate(
      {
         _id:          toObjectId(String(enrollmentId)),
         orgId:        toObjectId(orgId),
         currentStage: ENROLLMENT_STAGE.TRAINING_DEPT_REVIEW,
      },
      {
         $set: {
            "trainingDeptReview.juniorOfficerId": toObjectId(officerId),
            "trainingDeptReview.juniorAction":    action as TRAINING_DEPT_JUNIOR_ACTION,
            "trainingDeptReview.juniorNote":      note,
            "trainingDeptReview.juniorActedAt":   new Date(),
         },
         $push: {
            timeline: {
               stage:     ENROLLMENT_STAGE.TRAINING_DEPT_REVIEW,
               actorId:   toObjectId(officerId),
               actorType: ACTOR_TYPE.TRAINING_DEPT,
               action,
               note,
               at:        new Date(),
            },
         },
      },
      { new: true }
   );

   return { message: "Junior review recorded" };
};

// ─────────────────────────────────────────────────────────────────────────────
// Training Dept Senior action (approve | reject)
//
// Idempotency: stage filter on TRAINING_DEPT_REVIEW + check that junior has
// already acted (seniorAction still WAITING) prevents:
//   - Senior acting before junior
//   - Senior double-acting after stage has advanced
//
// Atomicity: single findOneAndUpdate.
// ─────────────────────────────────────────────────────────────────────────────

export const takeSeniorActionService = async (
   enrollmentId: string,
   officerId: string,
   orgId: string,
   action: string,
   note: string
) => {
   // 1. Validate action
   if (
      !Object.values(TRAINING_DEPT_SENIOR_ACTION).includes(
         action as TRAINING_DEPT_SENIOR_ACTION
      ) ||
      action === TRAINING_DEPT_SENIOR_ACTION.WAITING
   ) {
      throw new AppError(
         "Invalid action. Senior action must be 'approve' or 'reject'.",
         HTTP_STATUS.BAD_REQUEST
      );
   }

   // 2. Load enrollment — must be in TRAINING_DEPT_REVIEW and junior must have acted
   const existing = await enrollmentModel.findOne({
      _id:          toObjectId(String(enrollmentId)),
      orgId:        toObjectId(orgId),
      currentStage: ENROLLMENT_STAGE.TRAINING_DEPT_REVIEW,
   });

   if (!existing) {
      throw new AppError(MESSAGES.ENROLLMENT_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   if (!existing.trainingDeptReview) {
      throw new AppError(
         "Junior review must be completed before senior action.",
         HTTP_STATUS.CONFLICT
      );
   }

   // Idempotency guard: reject if senior has already acted
   if (
      (existing.trainingDeptReview as any)?.seniorAction !==
      TRAINING_DEPT_SENIOR_ACTION.WAITING
   ) {
      throw new AppError(
         "Senior review has already been recorded for this enrollment.",
         HTTP_STATUS.CONFLICT
      );
   }

   const approving = action === TRAINING_DEPT_SENIOR_ACTION.APPROVE;

   // 3. On approval, resolve local-vs-outstation BEFORE deciding the next
   // stage — local training skips the tour step entirely (no manager/OSD
   // travel approval needed), so the stage decision itself depends on this,
   // not just the email copy.
   const notificationContext = await loadNotificationContext(
      String(existing.employeeId),
      String(existing.programId)
   );
   const isLocal = approving
      ? isLocalTraining(notificationContext.employee?.placeOfPosting, notificationContext.program?.city)
      : false;

   const nextStage = !approving
      ? ENROLLMENT_STAGE.REJECTED
      : isLocal
         ? ENROLLMENT_STAGE.APPROVED
         : ENROLLMENT_STAGE.TOUR_PENDING_EMPLOYEE;

   const nextEnrollmentStatus = approving ? "approved" : "rejected";

   // 4. Atomic update — single round-trip. The filter re-checks currentStage,
   // so a second, racing request (double-click, or a second officer acting
   // concurrently) will find nothing to update once the first request has
   // already moved currentStage away from TRAINING_DEPT_REVIEW.
   const updated = await enrollmentModel.findOneAndUpdate(
      {
         _id:          toObjectId(String(enrollmentId)),
         orgId:        toObjectId(orgId),
         currentStage: ENROLLMENT_STAGE.TRAINING_DEPT_REVIEW,
      },
      {
         $set: {
            currentStage:                        nextStage,
            "statusSummary.enrollmentStatus":    nextEnrollmentStatus,
            "trainingDeptReview.seniorOfficerId": toObjectId(officerId),
            "trainingDeptReview.seniorAction":    action as TRAINING_DEPT_SENIOR_ACTION,
            "trainingDeptReview.seniorNote":      note,
            "trainingDeptReview.seniorActedAt":   new Date(),
            // Local training bypasses the tour form (submitTourFormService
            // never runs for it) — mirror the fields that function would
            // have set for a LOCAL choice, so tour.* doesn't stay at
            // whatever default enrollment-time value it started with.
            ...(approving && isLocal
               ? {
                  "tour.travelType":         TRAVEL_TYPE.LOCAL,
                  "tour.status":             TOUR_STATUS.NOT_REQUIRED,
                  "statusSummary.tourStatus": TOUR_STATUS.NOT_REQUIRED,
               }
               : {}),
         },
         $push: {
            timeline: {
               stage:     nextStage,
               actorId:   toObjectId(officerId),
               actorType: ACTOR_TYPE.TRAINING_DEPT,
               action,
               note,
               at:        new Date(),
            },
         },
      },
      { new: true }
   );

   if (!updated) {
      throw new AppError(
         "Senior review has already been recorded for this enrollment.",
         HTTP_STATUS.CONFLICT
      );
   }

   const { employee, programTitle } = notificationContext;
   if (employee) {
      (approving
         ? (isLocal
            ? sendEnrollmentApprovedLocalMail(employee.email, employee.name, programTitle)
            : sendEnrollmentApprovedOutstationMail(employee.email, employee.name, programTitle))
         : sendEnrollmentRejectedByTrainingDeptMail(employee.email, employee.name, programTitle)
      ).catch(logMailFailure(approving ? "enrollment-approved" : "enrollment-rejected-by-training-dept"));
   }

   return { currentStage: nextStage };
};

// ─────────────────────────────────────────────────────────────────────────────
// Tour CTD action (approve | reject) — final approval on the tour leg,
// replacing what OSD used to do here. Reject falls back to self_travel and
// is non-terminal — the enrollment still proceeds to APPROVED either way.
//
// Idempotency: stage filter on TOUR_CTD_REVIEW.
// Atomicity: single findOneAndUpdate.
// ─────────────────────────────────────────────────────────────────────────────

export const getPendingTourCtdApprovalsService = async (orgId: string) => {
   return await getPendingTourApprovalsForCtdRepo(orgId);
};

export const takeTourCtdActionService = async (
   enrollmentId: string,
   officerId: string,
   orgId: string,
   action: TOUR_CTD_ACTION,
   note: string
) => {
   if (
      !Object.values(TOUR_CTD_ACTION).includes(action as TOUR_CTD_ACTION) ||
      action === TOUR_CTD_ACTION.WAITING
   ) {
      throw new AppError(
         "Invalid action. Must be 'approve' or 'reject'.",
         HTTP_STATUS.BAD_REQUEST
      );
   }

   const existing = await enrollmentModel.findOne({
      _id: toObjectId(String(enrollmentId)),
      orgId: toObjectId(orgId),
      currentStage: ENROLLMENT_STAGE.TOUR_CTD_REVIEW,
   });

   if (!existing) {
      throw new AppError(MESSAGES.ENROLLMENT_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   const nextStage = ENROLLMENT_STAGE.APPROVED;
   const nextTourStatus =
      action === TOUR_CTD_ACTION.APPROVE
         ? TOUR_STATUS.CTD_APPROVED
         : TOUR_STATUS.CTD_REJECTED;

   const updateOps: any = {
      $set: {
         currentStage: nextStage,
         "tour.status": nextTourStatus,
         "statusSummary.tourStatus": nextTourStatus,
         "tour.ctdApproval": {
            officerId: toObjectId(officerId),
            action: action as TOUR_CTD_ACTION,
            note,
            actedAt: new Date(),
         },
      },
      $push: {
         timeline: {
            stage: nextStage,
            actorId: toObjectId(officerId),
            actorType: ACTOR_TYPE.TRAINING_DEPT,
            action: `tour_ctd_${action}`,
            note,
            at: new Date(),
         },
      },
   };

   // Fallback to self_travel if rejected
   if (action === TOUR_CTD_ACTION.REJECT) {
      updateOps.$set["tour.travelType"] = TRAVEL_TYPE.SELF_TRAVEL;
      if (existing.travelAndStay) {
         updateOps.$set["travelAndStay.status"] = TOUR_STATUS.REJECTED;
      }
   } else {
      if (existing.travelAndStay) {
         updateOps.$set["travelAndStay.status"] = TOUR_STATUS.APPROVED;
      }
   }

   const updated = await enrollmentModel.findOneAndUpdate(
      {
         _id: toObjectId(String(enrollmentId)),
         orgId: toObjectId(orgId),
         currentStage: ENROLLMENT_STAGE.TOUR_CTD_REVIEW,
      },
      updateOps,
      { new: true }
   );

   if (!updated) {
      throw new AppError(MESSAGES.ENROLLMENT_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   loadNotificationContext(String(updated.employeeId), String(updated.programId))
      .then(({ employee, programTitle }) => {
         if (!employee) return;
         return action === TOUR_CTD_ACTION.APPROVE
            ? sendTravelRequestApprovedMail(employee.email, employee.name, programTitle)
            : sendTravelRequestNotApprovedByCtdMail(employee.email, employee.name, programTitle);
      })
      .catch(logMailFailure("tour-ctd-action"));

   return { currentStage: nextStage };
};
