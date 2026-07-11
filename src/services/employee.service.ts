import { getApprovalStatsRepo, getDashboardSummaryRepo, getListedProgramsRepo } from "../repositories/employee.repository.js";
import { getEmployeeProgramsListRepo, getEmployeeProgramByIdRepo, getAvailableProgramsPaginatedRepo } from "../repositories/program.repository.js";
import {
   createEnrollmentRepo,
   findExistingEnrollmentRepo,
   getEmployeeEnrollmentsRepo,
   getEnrollmentDetailsRepo,
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
   ENROLLMENT_STATUS_SUMMARY,
   TRAVEL_TYPE,
   TOUR_OSD_ACTION,
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
   const managerApprovalRequired = organization.policy?.tourApproval?.managerApprovalRequired ?? true;
   const osdApprovalRequired = organization.policy?.tourApproval?.osdApprovalRequired ?? true;

   const travelType = travelAndStayInput?.travelType || TRAVEL_TYPE.LOCAL;

   let initialTourStatus = TOUR_STATUS.NOT_REQUIRED;
   if (travelType === TRAVEL_TYPE.COMPANY_ASSISTED) {
      initialTourStatus = managerApprovalRequired ? TOUR_STATUS.SUBMITTED : (osdApprovalRequired ? TOUR_STATUS.MANAGER_APPROVED : TOUR_STATUS.OSD_APPROVED);
   }

   const travelAndStay = {
      stayType,
      placeOfTour: travelAndStayInput?.placeOfTour || (program as any).city || program.venueName || "",
      frequentFlyerNo: travelAndStayInput?.frequentFlyerNo || "",
      modeOfTravel: travelAndStayInput?.modeOfTravel || "flight",
      purpose: travelAndStayInput?.purpose || "To Attend Training Program",
      bookingDetails: travelAndStayInput?.bookingDetails || [],
      advancePaymentRequired: travelAndStayInput?.advancePaymentRequired ?? 0,
      status: managerApprovalRequired ? TOUR_STATUS.SUBMITTED : TOUR_STATUS.APPROVED,
      managerAction: managerApprovalRequired ? MANAGER_ACTION.PENDING : MANAGER_ACTION.APPROVE,
      managerReason: ""
   };

   const tour = {
      travelType,
      status: initialTourStatus,
      details: {
         placeOfTour: travelAndStayInput?.placeOfTour || (program as any).city || program.venueName || "",
         frequentFlyerNo: travelAndStayInput?.frequentFlyerNo || "",
         modeOfTravel: travelAndStayInput?.modeOfTravel || "flight",
         purpose: travelAndStayInput?.purpose || "To Attend Training Program",
         advancePaymentRequired: travelAndStayInput?.advancePaymentRequired ?? 0,
         bookingDetails: travelAndStayInput?.bookingDetails || [],
      },
      managerApproval: {
         action: travelType === TRAVEL_TYPE.COMPANY_ASSISTED && managerApprovalRequired ? MANAGER_ACTION.PENDING : MANAGER_ACTION.APPROVE,
      },
      osdApproval: {
         action: travelType === TRAVEL_TYPE.COMPANY_ASSISTED && osdApprovalRequired ? TOUR_OSD_ACTION.WAITING : TOUR_OSD_ACTION.APPROVE,
      }
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
         tourStatus: managerApprovalRequired ? TOUR_STATUS.SUBMITTED : TOUR_STATUS.APPROVED,
         attendanceStatus: ATTENDANCE_RECORD_STATUS.PENDING,
         reimbursementStatus: REIMBURSEMENT_STATUS.NOT_STARTED
      },
      policySnapshot: {
         managerApproval: organization.policy?.managerApproval || { levels: 3, minLevelToApprove: 1 },
         trainingDeptApproval: organization.policy?.trainingDeptApproval || { enabled: true, levels: 2, minLevelToApprove: 2 },
         osdReview: organization.policy?.osdReview || { enabled: true, levels: 2, minLevelToApprove: 2 },
         tourApproval: organization.policy?.tourApproval || { managerApprovalRequired: true, osdApprovalRequired: true },
         reimbursementApproval: organization.policy?.reimbursementApproval || { managerApprovalRequired: true, osdApprovalRequired: true }
      },
      managerChain,
      managerApproval: {
         assignedApproverId: (user_hierarchy.managerId) || null,
         action: MANAGER_ACTION.PENDING,
         note: ""
      },
      travelAndStay,
      tour,
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
         training_providerId: created.providerOrgId?.toString(),
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

   const tourManagerApprovalRequired = enrollmentObj.policySnapshot?.tourApproval?.managerApprovalRequired ?? true;
   const tourOsdApprovalRequired = enrollmentObj.policySnapshot?.tourApproval?.osdApprovalRequired ?? true;

   enrollmentObj.travelAndStay = {
      stayType: enrollmentObj.travelAndStay?.stayType || "twin_sharing",
      placeOfTour: travelAndStayData.placeOfTour,
      frequentFlyerNo: travelAndStayData.frequentFlyerNo || "",
      modeOfTravel: travelAndStayData.modeOfTravel,
      purpose: travelAndStayData.purpose || "To Attend Training Program",
      bookingDetails: travelAndStayData.bookingDetails || [],
      advancePaymentRequired: travelAndStayData.advancePaymentRequired ?? 0,
      status: tourManagerApprovalRequired ? TOUR_STATUS.SUBMITTED : TOUR_STATUS.APPROVED,
      managerAction: tourManagerApprovalRequired ? MANAGER_ACTION.PENDING : MANAGER_ACTION.APPROVE,
      managerReason: ""
   };

   const travelType = travelAndStayData.travelType || enrollmentObj.tour?.travelType || TRAVEL_TYPE.LOCAL;
   let initialTourStatus = TOUR_STATUS.NOT_REQUIRED;
   if (travelType === TRAVEL_TYPE.COMPANY_ASSISTED) {
      initialTourStatus = tourManagerApprovalRequired ? TOUR_STATUS.SUBMITTED : (tourOsdApprovalRequired ? TOUR_STATUS.MANAGER_APPROVED : TOUR_STATUS.OSD_APPROVED);
   }

   enrollmentObj.tour = {
      travelType,
      status: initialTourStatus,
      details: {
         placeOfTour: travelAndStayData.placeOfTour || enrollmentObj.tour?.details?.placeOfTour || "",
         frequentFlyerNo: travelAndStayData.frequentFlyerNo || enrollmentObj.tour?.details?.frequentFlyerNo || "",
         modeOfTravel: travelAndStayData.modeOfTravel || enrollmentObj.tour?.details?.modeOfTravel || "flight",
         purpose: travelAndStayData.purpose || enrollmentObj.tour?.details?.purpose || "To Attend Training Program",
         advancePaymentRequired: travelAndStayData.advancePaymentRequired ?? enrollmentObj.tour?.details?.advancePaymentRequired ?? 0,
         bookingDetails: travelAndStayData.bookingDetails || enrollmentObj.tour?.details?.bookingDetails || [],
      },
      managerApproval: {
         action: travelType === TRAVEL_TYPE.COMPANY_ASSISTED && tourManagerApprovalRequired ? MANAGER_ACTION.PENDING : MANAGER_ACTION.APPROVE,
      },
      osdApproval: {
         action: travelType === TRAVEL_TYPE.COMPANY_ASSISTED && tourOsdApprovalRequired ? TOUR_OSD_ACTION.WAITING : TOUR_OSD_ACTION.APPROVE,
      }
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

   const tourManagerApprovalRequired = enrollmentObj.policySnapshot?.tourApproval?.managerApprovalRequired ?? true;
   enrollmentObj.currentStage = ENROLLMENT_STAGE.MANAGER_REVIEW;
   enrollmentObj.statusSummary.enrollmentStatus = ENROLLMENT_STATUS_SUMMARY.SUBMITTED;
   enrollmentObj.statusSummary.tourStatus = tourManagerApprovalRequired ? TOUR_STATUS.SUBMITTED : TOUR_STATUS.APPROVED;

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


