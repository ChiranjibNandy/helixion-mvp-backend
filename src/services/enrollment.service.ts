import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { getReleventEnrollRequestDto } from "../dtos/enrollment.dto.js";
import { getEnrollmentByUserIdInManagerChain } from "../repositories/enrollment.repository.js";
import { findOrgById } from "../repositories/organization.repository.js";
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
      approve: manager
        ? manager.level >= minLevel
        : false,
    };
  });

  return {
    data: result,
    pagination,
  };
};