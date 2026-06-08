import { getApprovalStatsRepo, getDashboardSummaryRepo, getListedProgramsRepo } from "../repositories/employee.repository.js";
import {
  getActiveEnrollmentsRepo,
  createEnrollmentRepo,
  checkExistingEnrollmentRepo,
  getEnrollmentCountForProgramRepo,
} from "../repositories/enrollment.repository.js";
import {
  getAvailableProgramsRepo,
  getAvailableProgramsPaginatedRepo,
  findProgramById,
} from "../repositories/program.repository.js";
import { getUserByIdRepo } from "../repositories/user.repository.js";
import { AppError } from "../utils/appError.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import {
  PROGRAM_SAVED_STATUS,
  ENROLLMENT_APPROVAL_STATUS,
  ENROLLMENT_SOURCE,
  STAY_TYPE_KEY,
  CURRENCY,
} from "../constants/enum.js";
import { Types } from "mongoose";
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

export const enrollInProgramService = async (
  userId:    string,
  programId: string,
  stayType:  STAY_TYPE_KEY,
  notes?:    string,
  source:    ENROLLMENT_SOURCE = ENROLLMENT_SOURCE.WEB
) => {
  const userObjectId    = new Types.ObjectId(userId);
  const programObjectId = new Types.ObjectId(programId);

  const [program, user] = await Promise.all([
    findProgramById(programId),
    getUserByIdRepo(userId),
  ]);

  if (!program || program.status !== PROGRAM_SAVED_STATUS.PUBLISHED) {
    throw new AppError(MESSAGES.PROGRAM_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  const locationMatched =
    !!user?.location &&
    !!program.venue &&
    user.location.trim().toLowerCase() === program.venue.trim().toLowerCase();

  const existing = await checkExistingEnrollmentRepo(userObjectId, programObjectId);
  if (existing) {
    throw new AppError(MESSAGES.PROGRAM_ALREADY_ENROLLED, HTTP_STATUS.CONFLICT);
  }

  if (program.maxParticipants) {
    const enrolled = await getEnrollmentCountForProgramRepo(programObjectId);
    if (enrolled >= program.maxParticipants) {
      throw new AppError(MESSAGES.PROGRAM_FULL, HTTP_STATUS.BAD_REQUEST);
    }
  }

  const enrollment = await createEnrollmentRepo({
    userId:    userObjectId,
    programId: programObjectId,
    stayType,
    feeAmount: resolveEnrollmentFee(program, stayType),
    currency:  CURRENCY.INR,
    programSnapshot: {
      title:               program.title,
      startDate:           program.startDate,
      endDate:             program.endDate,
      venue:               program.venue,
      training_providerId: program.training_providerId,
    },
    locationMatched,
    approvalStatus: ENROLLMENT_APPROVAL_STATUS.NOT_REQUIRED,
    source,
    notes,
  });

  return {
    enrollmentId:    enrollment._id!.toString(),
    status:          enrollment.status,
    approvalStatus:  enrollment.approvalStatus,
    feeAmount:       enrollment.feeAmount,
    currency:        enrollment.currency,
    programSnapshot: enrollment.programSnapshot,
  };
};
