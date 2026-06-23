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
import { AppError } from "../utils/appError.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import {
   APPROVAL_STATUS,
   ENROLLMENT_STATUS,
   ENROLLMENT_STAGE,
   STAY_TYPE,
   TOUR_STATUS,
   REIMBURSEMENT_STATUS,
   REVIEW_MODE,
   ROLE
} from "../constants/enum.js";
import { toObjectId } from "../utils/mongo.js";

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

   // 4. Map stayType to extract feeAmount from the program
   let feeAmount = 0;
   if (stayType === STAY_TYPE.SINGLE_OCCUPANCY || stayType === STAY_TYPE.SINGLE) {
      feeAmount = program.singleOccupancyFee || 0;
   } else if (stayType === STAY_TYPE.TWIN_SHARING || stayType === STAY_TYPE.TWIN) {
      feeAmount = program.twinSharingFee || 0;
   } else if (stayType === STAY_TYPE.NON_RESIDENTIAL || stayType === STAY_TYPE.NON_RES) {
      feeAmount = program.nonResidentialFee || 0;
   }

   // 5. Structure travel and stay details
   const travelAndStay = {
      stayType,
      placeOfTour: travelAndStayInput?.placeOfTour || (program as any).city || program.venue || "",
      frequentFlyerNo: travelAndStayInput?.frequentFlyerNo || "",
      modeOfTravel: travelAndStayInput?.modeOfTravel || "flight",
      purpose: travelAndStayInput?.purpose || "To Attend Training Program",
      bookingDetails: travelAndStayInput?.bookingDetails || [],
      advancePaymentRequired: travelAndStayInput?.advancePaymentRequired || 0,
      status: TOUR_STATUS.SUBMITTED,
      managerAction: APPROVAL_STATUS.PENDING,
      managerReason: ""
   };

   // 6. Build enrollment payload
   const enrollmentPayload: any = {
      orgId: (user as any).orgId,
      employeeId: toObjectId(userId),
      userId: toObjectId(userId),
      programId: toObjectId(programId),
      providerOrgId: (program as any).providerOrgId || (program as any).training_providerId,
      status: ENROLLMENT_STATUS.PENDING,
      approvalStatus: APPROVAL_STATUS.PENDING,
      currentStage: ENROLLMENT_STAGE.SUBMITTED,
      statusSummary: {
         enrollmentStatus: ENROLLMENT_STAGE.SUBMITTED,
         tourStatus: TOUR_STATUS.SUBMITTED,
         attendanceStatus: APPROVAL_STATUS.PENDING,
         reimbursementStatus: REIMBURSEMENT_STATUS.NOT_STARTED
      },
      policySnapshot: {
         managerApproval: { levels: 3, minLevelToApprove: 1 },
         trainingDeptApproval: { enabled: true, reviewMode: REVIEW_MODE.JUNIOR_SENIOR },
         osdReview: { enabled: true, reviewMode: REVIEW_MODE.JUNIOR_SENIOR }
      },
      managerApproval: {
         assignedApproverId: (user as any).hierarchy?.managerId || null,
         action: APPROVAL_STATUS.PENDING,
         note: ""
      },
      travelAndStay,
      notes,
      timeline: [
         {
            stage: ENROLLMENT_STAGE.SUBMITTED,
            actorId: toObjectId(userId),
            actorType: ROLE.EMPLOYEE,
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
      status: created.status,
      approvalStatus: created.approvalStatus,
      feeAmount,
      currency: "INR",
      programSnapshot: {
         title: program.title,
         startDate: program.startDate ? program.startDate.toISOString() : undefined,
         endDate: program.endDate ? program.endDate.toISOString() : undefined,
         venue: program.venue
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
      stayType: enrollmentObj.travelAndStay?.stayType || STAY_TYPE.TWIN_SHARING,
      placeOfTour: travelAndStayData.placeOfTour,
      frequentFlyerNo: travelAndStayData.frequentFlyerNo || "",
      modeOfTravel: travelAndStayData.modeOfTravel,
      purpose: travelAndStayData.purpose || "To Attend Training Program",
      bookingDetails: travelAndStayData.bookingDetails || [],
      advancePaymentRequired: travelAndStayData.advancePaymentRequired || 0,
      status: TOUR_STATUS.SUBMITTED,
      managerAction: APPROVAL_STATUS.PENDING,
      managerReason: ""
   };

   if (!enrollmentObj.timeline) {
      enrollmentObj.timeline = [];
   }
   enrollmentObj.timeline.push({
      stage: enrollmentObj.currentStage,
      actorId: toObjectId(userId),
      actorType: ROLE.EMPLOYEE,
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
      actorType: ROLE.EMPLOYEE,
      action: "submitted",
      note: "Submitted for manager approval",
      at: new Date()
   });

   await enrollmentObj.save();
   return enrollmentObj;
};


