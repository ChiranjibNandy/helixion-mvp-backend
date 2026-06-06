import { getActiveEnrollmentsRepo } from "../repositories/enrollment.repository.js";
import {
  getAvailableProgramsRepo,
  getAvailableProgramsPaginatedRepo,
  findProgramById,
} from "../repositories/program.repository.js";
import {
  createEnrollmentRepo,
  checkExistingEnrollmentRepo,
  getEnrollmentCountForProgramRepo,
} from "../repositories/enrollment.repository.js";
import { getUserByIdRepo } from "../repositories/user.repository.js";
import { AppError } from "../utils/appError.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import {
  PROGRAM_SAVED_STATUS,
  ENROLLMENT_APPROVAL_STATUS,
  ENROLLMENT_SOURCE,
  STAY_TYPE_KEY,
} from "../constants/enum.js";

// dashboard

export const getDashboardEnrollmentsService = async (userId: string) => {
  const enrollments       = await getActiveEnrollmentsRepo(userId);
  const availablePrograms = await getAvailableProgramsRepo();
  return { enrollments, availablePrograms };
};

// programs[paginated+ search]

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

// resolution type (single,double)

function resolveFee(program: any, stayType: string): number {
  switch (stayType) {
    case STAY_TYPE_KEY.SINGLE_OCCUPANCY: return program.singleOccupancyFee ?? 0;
    case STAY_TYPE_KEY.TWIN_SHARING:     return program.twinSharingFee     ?? 0;
    case STAY_TYPE_KEY.NON_RESIDENTIAL:  return program.nonResidentialFee  ?? 0;
    default:                             return 0;
  }
}

// enroll

export const enrollInProgramService = async (
  userId:   string,
  programId: string,
  stayType:  string,
  notes?:    string,
  source:    string = ENROLLMENT_SOURCE.WEB
) => {
  // verify program exists or not and is published
  const [program, user] = await Promise.all([
    findProgramById(programId),
    getUserByIdRepo(userId),
  ]);
  if (!program || program.status !== PROGRAM_SAVED_STATUS.PUBLISHED) {
    throw new AppError(MESSAGES.PROGRAM_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  // check if the user location matches the program venue (case insensitive)
  const locationMatched =
    !!user?.location &&
    !!program.venue &&
    user.location.trim().toLowerCase() === program.venue.trim().toLowerCase();

  // prevent duplicate active, pending enrollment
  const existing = await checkExistingEnrollmentRepo(userId, programId);
  if (existing) {
    throw new AppError(MESSAGES.PROGRAM_ALREADY_ENROLLED, HTTP_STATUS.CONFLICT);
  }

  // capacity check (when maxparticipant is set)
  if (program.maxParticipants) {
    const enrolled = await getEnrollmentCountForProgramRepo(programId);
    if (enrolled >= program.maxParticipants) {
      throw new AppError(MESSAGES.PROGRAM_FULL, HTTP_STATUS.BAD_REQUEST);
    }
  }

  // build enrollment payload
  const enrollment = await createEnrollmentRepo({
    userId,
    programId,
    stayType,

    // lock fee at enrollment time  prevents disputes if program price changes later
    feeAmount: resolveFee(program, stayType),
    currency:  "INR",

    // freeze program details at enrollment time  historical accuracy
    programSnapshot: {
      title:               program.title,
      startDate:           program.startDate,
      endDate:             program.endDate,
      venue:               program.venue,
      training_providerId: program.training_providerId,
    },

    // true when the user saved location matches the program venue
    locationMatched,

    // enterprise approval workflow (default not required for self service enrollments)
    approvalStatus: ENROLLMENT_APPROVAL_STATUS.NOT_REQUIRED,

    // traceability for track where the enrollment originated
    source,
    notes,
  });

  return {
    enrollmentId:   enrollment._id!.toString(),
    status:         enrollment.status,
    approvalStatus: enrollment.approvalStatus,
    feeAmount:      enrollment.feeAmount,
    currency:       enrollment.currency,
    programSnapshot: enrollment.programSnapshot,
  };
};
