import { Types } from "mongoose";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import {
   getPendingEnrollmentsForManagerRepo,
   getPendingReimbursementsForManagerRepo,
   takeReimbursementManagerActionRepo,
} from "../repositories/enrollment.repository.js";
import enrollmentModel from "../models/enrollment.model.js";
import { AppError } from "../utils/appError.js";
import {
   MANAGER_ACTION,
   MANAGER_CHAIN_STATUS,
   ENROLLMENT_STAGE,
   ACTOR_TYPE,
   TOUR_STATUS,
   ENROLLMENT_STATUS_SUMMARY,
   TRAVEL_TYPE,
   REIMBURSEMENT_ACTION,
   REIMBURSEMENT_STATUS,
} from "../constants/enum.js";
import { toObjectId } from "../utils/mongo.js";

// ─────────────────────────────────────────────────────────────────────────────
// Get pending enrollments for a manager
// ─────────────────────────────────────────────────────────────────────────────

export const getPendingEnrollmentsService = async (
   managerId: string,
   orgId: string,
   level?: number
) => {
   return await getPendingEnrollmentsForManagerRepo(
      managerId,
      orgId,
      level !== undefined ? { level } : {}
   );
};

// ─────────────────────────────────────────────────────────────────────────────
// Take action on an enrollment (recommend | approve | reject)
//
// Atomicity: uses findOneAndUpdate with $set + $push so the read-modify-write
// happens in a single round-trip. This eliminates the race condition where two
// concurrent requests could both read PENDING and both write conflicting state.
//
// Idempotency: the query filter includes `status: PENDING` on the chain entry,
// so a second request for the same manager on the same enrollment will find no
// document (the entry is no longer PENDING) and receive a 404 — preventing
// double-processing.
// ─────────────────────────────────────────────────────────────────────────────

export const takeManagerActionService = async (
   enrollmentId: string,
   managerId: string,
   orgId: string,
   action: string,
   note: string
) => {
   // 1. Validate action value
   if (
      !Object.values(MANAGER_ACTION).includes(action as MANAGER_ACTION) ||
      action === MANAGER_ACTION.PENDING
   ) {
      throw new AppError(
         "Invalid action. Must be recommend, approve, or reject.",
         HTTP_STATUS.BAD_REQUEST
      );
   }

   // 2. Load enrollment — must have this manager's chain entry in PENDING state
   //    (idempotency: if already acted, the query returns null → 404/409)
   const enrollment = await enrollmentModel.findOne({
      _id:   toObjectId(String(enrollmentId)),
      orgId: toObjectId(orgId),
      managerChain: {
         $elemMatch: {
            userId: toObjectId(managerId),
            status: MANAGER_CHAIN_STATUS.PENDING,
         },
      },
   });

   if (!enrollment) {
      // Either not found, or this manager already acted (idempotency guard)
      throw new AppError(
         MESSAGES.ENROLLMENT_NOT_FOUND,
         HTTP_STATUS.NOT_FOUND
      );
   }

   // 3. Determine the new chain-entry status
   const newChainStatus =
      action === MANAGER_ACTION.REJECT
         ? MANAGER_CHAIN_STATUS.REJECTED
         : MANAGER_CHAIN_STATUS.APPROVED;

   // 4. Determine next enrollment stage
   let nextStage: ENROLLMENT_STAGE = enrollment.currentStage;
   let nextEnrollmentStatus        = enrollment.statusSummary.enrollmentStatus;

   const arrayFilters: Record<string, any>[] = [
      { "actingElem.userId": toObjectId(managerId) },
   ];
   const updateOps: Record<string, any> = {
      $set: {
         "managerChain.$[actingElem].status": newChainStatus,
         "managerApproval.action":            action as MANAGER_ACTION,
         "managerApproval.note":              note,
         "managerApproval.actedAt":           new Date(),
         currentStage:                        nextStage,
         "statusSummary.enrollmentStatus":    nextEnrollmentStatus,
      },
      $push: {
         timeline: {
            stage:     nextStage,
            actorId:   toObjectId(managerId),
            actorType: ACTOR_TYPE.MANAGER,
            action,
            note,
            at:        new Date(),
         },
      },
   };

   const tourManagerApprovalRequired = enrollment.policySnapshot?.tourApproval?.managerApprovalRequired ?? true;

   if (action === MANAGER_ACTION.REJECT) {
      nextStage             = ENROLLMENT_STAGE.REJECTED;
      nextEnrollmentStatus  = ENROLLMENT_STATUS_SUMMARY.REJECTED;
      updateOps.$set.currentStage = nextStage;
      updateOps.$set["statusSummary.enrollmentStatus"] = nextEnrollmentStatus;
      updateOps.$push.timeline.stage = nextStage;
      if (enrollment.travelAndStay) {
         updateOps.$set["travelAndStay.managerAction"] = MANAGER_ACTION.REJECT;
         updateOps.$set["travelAndStay.status"] = TOUR_STATUS.REJECTED;
         updateOps.$set["statusSummary.tourStatus"] = TOUR_STATUS.REJECTED;
      }
      if (enrollment.tour) {
         updateOps.$set["tour.managerApproval.action"] = MANAGER_ACTION.REJECT;
         updateOps.$set["tour.managerApproval.actedAt"] = new Date();
         updateOps.$set["tour.managerApproval.note"] = note;
         updateOps.$set["tour.status"] = TOUR_STATUS.MANAGER_REJECTED;
      }
   } else {
      // Check whether the minimum required level has approved
      const minLevel      = enrollment.policySnapshot?.managerApproval?.minLevelToApprove ?? 1;
      const approvedChain = enrollment.managerChain.filter(
         (e) => (e as any).status === MANAGER_CHAIN_STATUS.APPROVED
      );
      // Include the entry we are about to approve (not yet persisted)
      const thisEntry = enrollment.managerChain.find(
         (e) => e.userId.toString() === managerId
      );
      const thisLevel    = thisEntry?.level ?? Infinity;
      const approvedLevels = [
         ...approvedChain.map((e) => e.level),
         thisLevel,
      ];
      const lowestApproved = Math.min(...approvedLevels);

      if (lowestApproved <= minLevel) {
         // Minimum required level has approved — advance to training dept review
         nextStage            = ENROLLMENT_STAGE.TRAINING_DEPT_REVIEW;
         nextEnrollmentStatus = ENROLLMENT_STATUS_SUMMARY.RECOMMENDED;
         updateOps.$set.currentStage = nextStage;
         updateOps.$set["statusSummary.enrollmentStatus"] = nextEnrollmentStatus;
         updateOps.$push.timeline.stage = nextStage;
         if (tourManagerApprovalRequired && enrollment.travelAndStay) {
            updateOps.$set["travelAndStay.managerAction"] = MANAGER_ACTION.APPROVE;
            updateOps.$set["travelAndStay.status"] = TOUR_STATUS.APPROVED;
            updateOps.$set["statusSummary.tourStatus"] = TOUR_STATUS.APPROVED;
         }
         const osdApprovalRequired = enrollment.policySnapshot?.tourApproval?.osdApprovalRequired ?? true;
         if (tourManagerApprovalRequired && enrollment.tour) {
            updateOps.$set["tour.managerApproval.action"] = MANAGER_ACTION.APPROVE;
            updateOps.$set["tour.managerApproval.actedAt"] = new Date();
            updateOps.$set["tour.managerApproval.note"] = note;
            
            if (enrollment.tour.travelType === TRAVEL_TYPE.COMPANY_ASSISTED) {
                updateOps.$set["tour.status"] = osdApprovalRequired ? TOUR_STATUS.MANAGER_APPROVED : TOUR_STATUS.OSD_APPROVED;
            } else {
                updateOps.$set["tour.status"] = TOUR_STATUS.NOT_REQUIRED;
            }
         }
      }
   }

   // 5. Find the next WAITING chain entry to activate (if any)
   const nextWaiting = enrollment.managerChain
      .filter((e) => (e as any).status === MANAGER_CHAIN_STATUS.WAITING)
      .sort((a, b) => a.level - b.level)[0];

   // Activate the next waiting manager level atomically
   if (nextWaiting && action !== MANAGER_ACTION.REJECT) {
      arrayFilters.push({ "waitingElem.userId": nextWaiting.userId });
      updateOps.$set["managerChain.$[waitingElem].status"] =
         MANAGER_CHAIN_STATUS.PENDING;
   }

   await enrollmentModel.findOneAndUpdate(
      {
         _id:   toObjectId(String(enrollmentId)),
         orgId: toObjectId(orgId),
         managerChain: {
            $elemMatch: {
               userId: toObjectId(managerId),
               status: MANAGER_CHAIN_STATUS.PENDING,
            },
         },
      },
      updateOps,
      { arrayFilters, new: true }
   );

   return { currentStage: nextStage };
};

// ─────────────────────────────────────────────────────────────────────────────
// Get pending reimbursement claims awaiting this manager's approval
// ─────────────────────────────────────────────────────────────────────────────

export const getPendingReimbursementsService = async (
   managerId: string,
   orgId: string
) => {
   return await getPendingReimbursementsForManagerRepo(managerId, orgId);
};

// ─────────────────────────────────────────────────────────────────────────────
// Manager approve/reject a reimbursement claim (approve | reject)
//
// Single-tier gate — no chain, keyed on the same assignedApproverId set when
// the enrollment was created. Reject is terminal (no rework loop, per ticket
// 0031's linear flow); approve hands off to OSD review.
// ─────────────────────────────────────────────────────────────────────────────

export const takeReimbursementManagerActionService = async (
   enrollmentId: string,
   managerId: string,
   orgId: string,
   action: REIMBURSEMENT_ACTION,
   note: string
) => {
   if (
      !Object.values(REIMBURSEMENT_ACTION).includes(action) ||
      action === REIMBURSEMENT_ACTION.PENDING ||
      action === REIMBURSEMENT_ACTION.WAITING
   ) {
      throw new AppError(MESSAGES.INVALID_REIMBURSEMENT_ACTION, HTTP_STATUS.BAD_REQUEST);
   }

   const nextStage =
      action === REIMBURSEMENT_ACTION.REJECT
         ? ENROLLMENT_STAGE.REJECTED
         : ENROLLMENT_STAGE.REIMBURSEMENT_OSD_REVIEW;

   const nextReimbursementStatus =
      action === REIMBURSEMENT_ACTION.REJECT
         ? REIMBURSEMENT_STATUS.REJECTED
         : REIMBURSEMENT_STATUS.SUBMITTED;

   const updated = await takeReimbursementManagerActionRepo(
      enrollmentId,
      orgId,
      managerId,
      {
         currentStage:                    nextStage,
         "reimbursement.status":          nextReimbursementStatus,
         "reimbursement.managerApproval": { action, note, actedAt: new Date() },
      },
      {
         stage:     nextStage,
         actorId:   toObjectId(managerId),
         actorType: ACTOR_TYPE.MANAGER,
         action,
         note,
         at:        new Date(),
      }
   );

   if (!updated) {
      throw new AppError(MESSAGES.ENROLLMENT_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   return { currentStage: nextStage };
};
