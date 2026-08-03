import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { ENROLLMENT_STAGE, MANAGER_CHAIN_STATUS } from "../constants/enum.js";
import { getReleventEnrollRequestDto } from "../dtos/enrollment.dto.js";
import {
  getEnrollmentByUserIdInManagerChain,
  findEnrollmentForManagerRepo,
  getEmployeeTrainingHistoryRepo,
} from "../repositories/enrollment.repository.js";
import { getUserByIdRepo } from "../repositories/user.repository.js";
import { AppError } from "../utils/appError.js";
import { findOrgById } from "../repositories/organization.repository.js";

export const getRelevantEnrollmentService = async (
  request: getReleventEnrollRequestDto
) => {
  const user = await getUserByIdRepo(request.managerId);

  if (!user?.orgId) {
    throw new AppError(
      MESSAGES.USER_NOT_EXIST_ORG,
      HTTP_STATUS.NOT_FOUND
    );
  }

  const organization = await findOrgById(user.orgId);

  if (!organization) {
    throw new AppError(
      MESSAGES.ORG_NOT_FOUND,
      HTTP_STATUS.NOT_FOUND
    );
  }

  const { enrollments, pagination } =
    await getEnrollmentByUserIdInManagerChain(
      user,
      request.page,
      request.limit,
      request.search
    );

  // Whether this manager can act mirrors takeManagerActionService's own
  // eligibility check exactly: a PENDING entry for them in managerChain,
  // on an enrollment still at MANAGER_REVIEW. Previously this compared
  // `manager.level >= minLevelToApprove` instead — since level 0 is the
  // DIRECT (most common) manager and minLevelToApprove defaults to 1, that
  // locked the "Review" button for every direct manager, on every
  // enrollment, regardless of whether their approval was actually due.
  // Level only matters for what happens AFTER approving (whether the chain
  // needs to escalate further) — it was never a gate on who may act at all.
  const result = enrollments.map((enrollment: any) => {
    const manager = enrollment.managerChain?.find(
      (m: any) => String(m.userId) === String(user._id)
    );

    return {
      ...enrollment,
      approve: (manager?.status === MANAGER_CHAIN_STATUS.PENDING)
        && enrollment.currentStage == ENROLLMENT_STAGE.MANAGER_REVIEW,
    };
  });

  return {
    data: result,
    pagination,
  };
};



export const getEmployeeTrainingHistoryService = async (
  enrollmentId: string,
  managerId: string,
  orgId: string
) => {
  const enrollment = await findEnrollmentForManagerRepo(enrollmentId, managerId, orgId);

  if (!enrollment) {
    throw new AppError(MESSAGES.ENROLLMENT_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  const history = await getEmployeeTrainingHistoryRepo(
    String(enrollment.employeeId),
    enrollmentId
  );

  return history.map((entry: any) => ({
    enrollmentId: entry._id.toString(),
    program: entry.programId?.title,
    trainingInstitute: entry.programId?.trainingInstitute,
    from: entry.programId?.startDate,
    to: entry.programId?.endDate,
    venue: entry.programId?.venueName || entry.programId?.city,
    brochureUrl: entry.programId?.brochureUrl,
  }));
};
