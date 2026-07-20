import { Types } from "mongoose";
import {
   ENROLLMENT_STAGE,
   TOUR_STATUS,
   REIMBURSEMENT_STATUS,
   MANAGER_ACTION,
   MANAGER_CHAIN_STATUS,
   TRAINING_DEPT_JUNIOR_ACTION,
   TRAINING_DEPT_SENIOR_ACTION,
   REIMBURSEMENT_ACTION,
   ACTOR_TYPE,
   ATTENDANCE_RECORD_STATUS,
   ENROLLMENT_STATUS_SUMMARY,
   TRAVEL_TYPE,
   TOUR_CTD_ACTION,
} from "../constants/enum.js";

export interface IManagerChainItem {
   userId: Types.ObjectId;
   level: number;                       // 1 = direct manager
   status: MANAGER_CHAIN_STATUS;        // pending | waiting | approved | rejected
}

export interface IBookingDetail {
   from: string;
   to: string;
   refNo: string;
   departureTime: string;
   travelDate: Date;
   travelClass: string;
}

export interface ITimelineEntry {
   stage: ENROLLMENT_STAGE;
   actorId?: Types.ObjectId;
   actorType: ACTOR_TYPE;
   action: string;
   note?: string;
   at: Date;
}

/**
 * The Enrollment document carries the full lifecycle.
 *
 * Design decisions:
 * - `managerChain` is a FROZEN copy from user.hierarchy.managerChain at
 *   enrollment creation time. This means approver identity never changes
 *   even if the org restructures after the fact.
 * - `policySnapshot` is similarly frozen from org.policy at creation time.
 * - Officer IDs (trainingDeptReview) are assigned at enrollment time
 *   (pool/assigned per policy), NOT stored on the User doc.
 * - `userId` is kept as an alias for `employeeId` for backward-compat with
 *   existing dashboard queries. Both point to the same user.
 */
export interface IEnrollment {
   _id?: Types.ObjectId;

   orgId?: Types.ObjectId;
   employeeId: Types.ObjectId;
   programId: Types.ObjectId;
   providerOrgId?: Types.ObjectId;

   currentStage: ENROLLMENT_STAGE;

   statusSummary: {
      enrollmentStatus: ENROLLMENT_STATUS_SUMMARY;         // submitted | recommended | approved | rejected
      tourStatus: TOUR_STATUS;
      attendanceStatus: ATTENDANCE_RECORD_STATUS;
      reimbursementStatus: REIMBURSEMENT_STATUS;
   };

   policySnapshot?: {
      managerApproval?: { levels: number; minLevelToApprove: number };
      trainingDeptApproval?: { enabled: boolean; levels: number; minLevelToApprove: number };
      osdReview?: { enabled: boolean; levels: number; minLevelToApprove: number };
      tourApproval?: { managerApprovalRequired: boolean; ctdApprovalRequired: boolean };
      reimbursementApproval?: { managerApprovalRequired: boolean; osdApprovalRequired: boolean };
   };

   /** Frozen copy of the full manager chain at enrollment creation time */
   managerChain: IManagerChainItem[];

   managerApproval: {
      assignedApproverId?: Types.ObjectId;   // usually level-1 manager
      action: MANAGER_ACTION;
      note?: string;
      actedAt?: Date;
   };

   trainingDeptReview?: {
      juniorOfficerId?: Types.ObjectId;
      juniorAction: TRAINING_DEPT_JUNIOR_ACTION;
      juniorNote?: string;
      juniorActedAt?: Date;
      seniorOfficerId?: Types.ObjectId;
      seniorAction: TRAINING_DEPT_SENIOR_ACTION;
      seniorNote?: string;
      seniorActedAt?: Date;
   };

   travelAndStay?: {
      stayType: string;
      placeOfTour?: string;
      frequentFlyerNo?: string;
      modeOfTravel?: string;
      purpose?: string;
      bookingDetails?: IBookingDetail[];
      advancePaymentRequired?: number;
      status?: TOUR_STATUS;
      managerAction?: MANAGER_ACTION;
      managerReason?: string;
   };

   tour?: {
      travelType: TRAVEL_TYPE;
      status: TOUR_STATUS;
      details?: {
         placeOfTour?: string;
         frequentFlyerNo?: string;
         modeOfTravel?: string;
         purpose?: string;
         advancePaymentRequired?: number;
         bookingDetails?: IBookingDetail[];
      };
      managerApproval?: {
         action: MANAGER_ACTION;
         note?: string;
         actedAt?: Date;
      };
      ctdApproval?: {
         officerId?: Types.ObjectId;
         action: TOUR_CTD_ACTION;
         note?: string;
         actedAt?: Date;
      };
   };

   attendance?: {
      uploadedByProvider?: boolean;
      uploadedAt?: Date;
      status?: ATTENDANCE_RECORD_STATUS;
   };

   reimbursement?: {
      enabled?: boolean;
      status?: REIMBURSEMENT_STATUS;
      expenses?: {
         travelCost: number;
         accommodationCost: number;
         foodCost: number;
      };
      receipts?: string[];
      totalAmount?: number;
      managerApproval?: {
         action: REIMBURSEMENT_ACTION;
         note?: string;
         actedAt?: Date;
      };
      osdApproval?: {
         action: REIMBURSEMENT_ACTION;
         note?: string;
         actedAt?: Date;
      };
   };

   timeline: ITimelineEntry[];

   notes?: string;

   createdAt: Date;
   updatedAt: Date;
}
