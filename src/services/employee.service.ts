import { getApprovalStatsRepo, getDashboardSummaryRepo, getListedProgramsRepo } from "../repositories/employee.repository.js";
import { getEmployeeProgramsListRepo, getEmployeeProgramByIdRepo, getAvailableProgramsPaginatedRepo } from "../repositories/program.repository.js";
import {
   createEnrollmentRepo,
   findExistingEnrollmentRepo,
   getEmployeeEnrollmentsRepo,
   getEnrollmentDetailsRepo,
   getManagerDashboardSummaryRepo,
   getManagerApprovalStatsRepo,
   getManagerPendingTeamEnrollmentsRepo,
} from "../repositories/enrollment.repository.js";
import userModel from "../models/user.model.js";
import enrollmentModel from "../models/enrollment.model.js";
import { organizationModel } from "../models/organization.model.js";
import { AppError } from "../utils/appError.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import {
   ENROLLMENT_STAGE,
   TOUR_STATUS,
   REIMBURSEMENT_STATUS,
   MANAGER_ACTION,
   MANAGER_CHAIN_STATUS,
   ACTOR_TYPE,
   ATTENDANCE_RECORD_STATUS,
} from "../constants/enum.js";
import { toObjectId } from "../utils/mongo.js";
import { resolveEnrollmentFee } from "../utils/fee.js";


export const getEmployeeDashboardService = async (userId: string) => {
  const [summary, approvalStats, listedPrograms] = await Promise.all([
    getDashboardSummaryRepo(userId),
    getApprovalStatsRepo(userId),
    getListedProgramsRepo(userId),
  ]);

  return { summary, approvalStats, listedPrograms };
};

export const getAvailableProgramsService = async (params: {
  page:      number;
  limit:     number;
  search?:   string;
  venue?:    string;
  fromDate?: string;
  toDate?:   string;
}) => {
  return await getAvailableProgramsPaginatedRepo(params);
};

export const getEmployeeProgramsListService = async (params: {
   page: number;
   limit: number;
   search?: string;
   venue?: string;
   fromDate?: string;
   toDate?: string;
}) => {
   return await getEmployeeProgramsListRepo(params);
};

export const getEmployeeProgramByIdService = async (id: string) => {
   const program = await getEmployeeProgramByIdRepo(id);
   if (!program) {
      throw new AppError(MESSAGES.PROGRAM_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }
   return program;
};

export const enrollInProgramService = async (
   userId: string,
   programId: string,
   stayType: string,
   notes?: string,
   travelAndStayInput?: any
) => {
   // 1. Verify program exists and is published
   const program = await getEmployeeProgramByIdRepo(programId);
   if (!program) {
      throw new AppError(MESSAGES.PROGRAM_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   // 2. Check if already enrolled (active or pending)
   const existing = await findExistingEnrollmentRepo(userId, programId);
   if (existing) {
      throw new AppError(MESSAGES.ENROLLMENT_ALREADY_EXISTS, HTTP_STATUS.CONFLICT);
   }

   // 3. Retrieve user to get orgId and reporting manager (assignedApproverId)
   const user = await userModel.findById(userId);
   if (!user) {
      throw new AppError(MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   // 3.5. Retrieve organization to get its policy
   const organization = await organizationModel.findById((user as any).orgId);
   if (!organization) {
      throw new AppError(MESSAGES.ORG_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   // 4. Resolve fee from stayOptions array
   const feeAmount = resolveEnrollmentFee(program, stayType);

   // 5. Structure travel and stay details
   const travelAndStay = {
      stayType,
      placeOfTour: travelAndStayInput?.placeOfTour || (program as any).city || program.venueName || "",
      frequentFlyerNo: travelAndStayInput?.frequentFlyerNo || "",
      modeOfTravel: travelAndStayInput?.modeOfTravel || "flight",
      purpose: travelAndStayInput?.purpose || "To Attend Training Program",
      bookingDetails: travelAndStayInput?.bookingDetails || [],
      advancePaymentRequired: travelAndStayInput?.advancePaymentRequired || 0,
      status: TOUR_STATUS.SUBMITTED,
      managerAction: MANAGER_ACTION.PENDING,
      managerReason: ""
   };


   // 6. Build enrollment payload
   const user_hierarchy = (user as any).hierarchy || {};
   const managerChain = (user_hierarchy.managerChain || []).map((entry: any) => ({
      userId: entry.userId,
      level:  entry.level,
      status: MANAGER_CHAIN_STATUS.WAITING,
   }));
   // Activate the first level immediately
   if (managerChain.length > 0) {
      managerChain[0].status = MANAGER_CHAIN_STATUS.PENDING;
   }

   const enrollmentPayload: any = {
      orgId: (user as any).orgId,
      employeeId: toObjectId(userId),
      programId: toObjectId(programId),
      providerOrgId: (program as any).providerOrgId || (program as any).createdBy,
      currentStage: ENROLLMENT_STAGE.SUBMITTED,
      statusSummary: {
         enrollmentStatus: "submitted",
         tourStatus: TOUR_STATUS.SUBMITTED,
         attendanceStatus: ATTENDANCE_RECORD_STATUS.PENDING,
         reimbursementStatus: REIMBURSEMENT_STATUS.NOT_STARTED
      },
      policySnapshot: {
         managerApproval: organization.policy?.managerApproval || { levels: 3, minLevelToApprove: 1 },
         trainingDeptApproval: organization.policy?.trainingDeptApproval || { enabled: true, levels: 2, minLevelToApprove: 2 },
         osdReview: organization.policy?.osdReview || { enabled: true, levels: 2, minLevelToApprove: 2 }
      },
      managerChain,
      managerApproval: {
         assignedApproverId: (user_hierarchy.managerId) || null,
         action: MANAGER_ACTION.PENDING,
         note: ""
      },
      travelAndStay,
      notes,
      timeline: [
         {
            stage: ENROLLMENT_STAGE.SUBMITTED,
            actorId: toObjectId(userId),
            actorType: ACTOR_TYPE.EMPLOYEE,
            action: "created",
            note: "Enrollment request submitted",
            at: new Date()
         }
      ]
   };


   // Save to DB
   const created = await createEnrollmentRepo(enrollmentPayload);

   return {
      enrollmentId: created._id.toString(),
      currentStage: created.currentStage,
      feeAmount,
      currency: "INR",
      programSnapshot: {
         title: program.title,
         startDate: program.startDate ? program.startDate.toISOString() : undefined,
         endDate: program.endDate ? program.endDate.toISOString() : undefined,
         venueName: program.venueName,
         city: program.city,
      }
   };

};

export const getEmployeeEnrollmentsService = async (userId: string) => {
   return await getEmployeeEnrollmentsRepo(userId);
};

export const getEnrollmentDetailsService = async (id: string, userId: string) => {
   const enrollmentObj = await getEnrollmentDetailsRepo(id, userId);
   if (!enrollmentObj) {
      throw new AppError(MESSAGES.ENROLLMENT_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }
   return enrollmentObj;
};

export const updateTravelDetailsService = async (
   userId: string,
   enrollmentId: string,
   travelAndStayData: any
) => {
   const enrollmentObj = await enrollmentModel.findOne({
      _id: toObjectId(enrollmentId),
      $or: [
         { employeeId: toObjectId(userId) },
         { userId: toObjectId(userId) }
      ]
   });

   if (!enrollmentObj) {
      throw new AppError(MESSAGES.ENROLLMENT_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   enrollmentObj.travelAndStay = {
      stayType: enrollmentObj.travelAndStay?.stayType || "twin_sharing",
      placeOfTour: travelAndStayData.placeOfTour,
      frequentFlyerNo: travelAndStayData.frequentFlyerNo || "",
      modeOfTravel: travelAndStayData.modeOfTravel,
      purpose: travelAndStayData.purpose || "To Attend Training Program",
      bookingDetails: travelAndStayData.bookingDetails || [],
      advancePaymentRequired: travelAndStayData.advancePaymentRequired || 0,
      status: TOUR_STATUS.SUBMITTED,
      managerAction: MANAGER_ACTION.PENDING,
      managerReason: ""
   };

   if (!enrollmentObj.timeline) {
      enrollmentObj.timeline = [];
   }
   enrollmentObj.timeline.push({
      stage: enrollmentObj.currentStage,
      actorId: toObjectId(userId),
      actorType: ACTOR_TYPE.EMPLOYEE,
      action: "updated_travel",
      note: "Updated travel and stay details",
      at: new Date()
   });


   await enrollmentObj.save();
   return enrollmentObj;
};

export const getManagerDashboardService = async (managerId: string) => {
   const [summary, approvalStats, pendingTeamEnrollments] = await Promise.all([
      getManagerDashboardSummaryRepo(managerId),
      getManagerApprovalStatsRepo(managerId),
      getManagerPendingTeamEnrollmentsRepo(managerId),
   ]);
   return { summary, approvalStats, pendingTeamEnrollments };
};

export const submitEnrollmentService = async (userId: string, enrollmentId: string) => {
   const enrollmentObj = await enrollmentModel.findOne({
      _id: toObjectId(enrollmentId),
      $or: [
         { employeeId: toObjectId(userId) },
         { userId: toObjectId(userId) }
      ]
   });

   if (!enrollmentObj) {
      throw new AppError(MESSAGES.ENROLLMENT_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   enrollmentObj.currentStage = ENROLLMENT_STAGE.MANAGER_REVIEW;
   enrollmentObj.statusSummary.enrollmentStatus = ENROLLMENT_STAGE.SUBMITTED;
   enrollmentObj.statusSummary.tourStatus = TOUR_STATUS.SUBMITTED;

   if (!enrollmentObj.timeline) {
      enrollmentObj.timeline = [];
   }
   enrollmentObj.timeline.push({
      stage: ENROLLMENT_STAGE.MANAGER_REVIEW,
      actorId: toObjectId(userId),
      actorType: ACTOR_TYPE.EMPLOYEE,

      action: "submitted",
      note: "Submitted for manager approval",
      at: new Date()
   });

   await enrollmentObj.save();
   return enrollmentObj;
};


