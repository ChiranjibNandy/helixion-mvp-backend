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

  const minLevel =
    organization.policy.managerApproval.minLevelToApprove;

  const { enrollments, pagination } =
    await getEnrollmentByUserIdInManagerChain(
      user,
      request.page,
      request.limit,
      request.search
    );

  const result = enrollments.map((enrollment: any) => {
    const manager = enrollment.managerChain?.find(
      (m: any) => String(m.userId) === String(user._id)
    );

    return {
      ...enrollment,
      approve: (manager
        ? manager.level >= minLevel
        : false) && enrollment.currentStage == ENROLLMENT_STAGE.MANAGER_REVIEW,
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
