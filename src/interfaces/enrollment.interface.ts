import { Types } from "mongoose";
import {
   APPROVAL_STATUS,
   ENROLLMENT_STATUS,
   ENROLLMENT_STAGE,
   TOUR_STATUS,
   REIMBURSEMENT_STATUS,
   REVIEW_MODE
} from "../constants/enum.js";

export interface IEnrollment {
   _id?: Types.ObjectId;
   orgId?: Types.ObjectId;
   employeeId: Types.ObjectId;
   userId: Types.ObjectId; // Kept for backward compatibility with dashboard queries
   programId: Types.ObjectId;
   providerOrgId?: Types.ObjectId;
   status: ENROLLMENT_STATUS;
   approvalStatus: APPROVAL_STATUS;
   currentStage: ENROLLMENT_STAGE;
   statusSummary: {
      enrollmentStatus: ENROLLMENT_STAGE;
      tourStatus: TOUR_STATUS;
      attendanceStatus: APPROVAL_STATUS;
      reimbursementStatus: REIMBURSEMENT_STATUS;
   };
   policySnapshot?: {
      managerApproval?: { levels: number; minLevelToApprove: number };
      trainingDeptApproval?: { enabled: boolean; reviewMode: REVIEW_MODE };
      osdReview?: { enabled: boolean; reviewMode: REVIEW_MODE };
   };
   managerApproval: {
      assignedApproverId?: Types.ObjectId;
      action: APPROVAL_STATUS;
      note?: string;
      actedAt?: Date;
   };
   trainingDeptReview?: {
      juniorOfficerId?: Types.ObjectId;
      juniorNote?: string;
      juniorStatus?: string;
      seniorOfficerId?: Types.ObjectId;
      seniorAction?: string;
      seniorNote?: string;
      seniorActedAt?: Date;
   };
   travelAndStay?: {
      stayType: string;
      placeOfTour?: string;
      frequentFlyerNo?: string;
      modeOfTravel?: string;
      purpose?: string;
      bookingDetails?: Array<{
         from: string;
         to: string;
         refNo: string;
         departureTime: string;
         travelDate: Date;
         travelClass: string;
      }>;
      advancePaymentRequired?: number;
      status?: TOUR_STATUS;
      managerAction?: APPROVAL_STATUS;
      managerReason?: string;
   };
   attendance?: {
      uploadedByProvider?: boolean;
      uploadedAt?: Date;
      status?: string;
   };
   reimbursement?: {
      submittedAt?: Date;
      expenses?: {
         travelCost: number;
         accommodationCost: number;
         foodCost: number;
      };
      receipts?: string[];
      totalAmount?: number;
      osdJunior?: {
         officerId?: Types.ObjectId;
         action?: string;
         note?: string;
         actedAt?: Date;
      };
      osdSenior?: {
         officerId?: Types.ObjectId;
         action?: string;
         note?: string;
         actedAt?: Date;
      };
   };
   timeline?: Array<{
      stage: string;
      actorId?: Types.ObjectId;
      actorType: string;
      action: string;
      note?: string;
      at: Date;
   }>;
   createdAt: Date;
   updatedAt: Date;
}