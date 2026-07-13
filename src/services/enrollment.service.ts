import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { MANAGER_CHAIN_STATUS } from "../constants/enum.js";
import { getReleventEnrollRequestDto } from "../dtos/enrollment.dto.js";
import {
  getEnrollmentByUserIdInManagerChain,
  findEnrollmentForManagerRepo,
  getEmployeeTrainingHistoryRepo,
} from "../repositories/enrollment.repository.js";
import { getUserByIdRepo } from "../repositories/user.repository.js";
import { AppError } from "../utils/appError.js";

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

  const { enrollments, pagination } =
    await getEnrollmentByUserIdInManagerChain(
      user,
      request.page,
      request.limit,
      request.search
    );

  // `approve` reflects whether takeManagerActionService will actually accept
  // an approve/reject call from this manager right now — that endpoint's own
  // idempotency guard requires a managerChain entry for this manager with
  // status PENDING, so this must mirror that exact condition (previously
  // compared managerChain level against the org's minLevelToApprove, which
  // doesn't correspond to any precondition the action endpoint enforces).
  const result = enrollments.map((enrollment: any) => {
    const manager = enrollment.managerChain?.find(
      (m: any) => String(m.userId) === String(user._id)
    );

    return {
      ...enrollment,
      approve: manager?.status === MANAGER_CHAIN_STATUS.PENDING,
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
    enrollmentId:      entry._id.toString(),
    program:           entry.programId?.title,
    trainingInstitute: entry.programId?.trainingInstitute,
    from:              entry.programId?.startDate,
    to:                entry.programId?.endDate,
    venue:             entry.programId?.venueName || entry.programId?.city,
    brochureUrl:       entry.programId?.brochureUrl,
  }));
};
