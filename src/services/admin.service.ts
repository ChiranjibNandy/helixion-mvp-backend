import { MESSAGES } from "../constants/messages.js";
import { PendingRegistrationsDto } from "../dtos/registration.dto.js";
import { getPendingRegistrationsRepository } from "../repositories/admin.repository.js";
import { mapUserToPendingRegistrationDto } from "../mapper/admin.mapper.js";
import { approveUserRepository,   } from "../repositories/user.repository.js";

// Retrieve a list of users with pending registration status for admin, supporting pagination and limit
export const getPendingRegistrationsService = async (
  page: number,
  limit: number
): Promise<PendingRegistrationsDto> => {

  const { users, total } =
    await getPendingRegistrationsRepository(
      page,
      limit
    );

  const mappedUsers = users.map(
    mapUserToPendingRegistrationDto
  );

  const totalPages = Math.ceil(total / limit);

  return {
    data: mappedUsers,
    meta: {
      total,
      page,
      limit,
      totalPages,
    },
  };
};

// Approve a user by admin, assign the specified role, and set the user status to active

export const approveUserAndAddRoleService = async (
  id: string,
  role: string,
  description?: string
) => {
  const updatedUser =
    await approveUserRepository(
      id,
      role,
      description
    );

  if (!updatedUser) {
    throw new Error(MESSAGES.USER_NOT_FOUND);
  }
  const mapUser = mapUserToPendingRegistrationDto(updatedUser)

  return mapUser;
};
