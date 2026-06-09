import { Types } from "mongoose";

export interface IEnrollment {
   _id?: Types.ObjectId;
   orgId?: Types.ObjectId;
   employeeId: Types.ObjectId;
   userId: Types.ObjectId; // Kept for backward compatibility with dashboard queries
   programId: Types.ObjectId;
   providerOrgId?: Types.ObjectId;
   status: string;
   approvalStatus: string;
   currentStage: string;
   statusSummary: {
      enrollmentStatus: string;
      tourStatus: string;
      attendanceStatus: string;
      reimbursementStatus: string;
   };
   policySnapshot?: {
      managerApproval?: { levels: number; minLevelToApprove: number };
      trainingDeptApproval?: { enabled: boolean; reviewMode: string };
      osdReview?: { enabled: boolean; reviewMode: string };
   };
   managerApproval: {
      assignedApproverId?: Types.ObjectId;
      action: string;
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
      status?: string;
      managerAction?: string;
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