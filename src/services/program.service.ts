import { mapUserBasicDetail } from "../mapper/user.mapper.js";
import { getProgramParticipantsRepo } from "../repositories/enrollment.repository.js";
import { getPublishedProgramsRepo, findProgramById } from "../repositories/program.repository.js";
import { GetPublishedProgramsServiceParams } from "../types/program.js";
import { AppError } from "../utils/appError.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";

export const getPublishedProgramsService = async ({
   userId,
   page = 1,
   limit = 10,
}: GetPublishedProgramsServiceParams) => {
   return await getPublishedProgramsRepo({
      trainingProviderId: userId,
      page,
      limit,
   });
};



// Confirms the requesting Training Provider owns this program before any
// participant/attendance data is read or written for it (ticket 0032).
// Reused across program.service.ts and attendance.service.ts so ownership
// is enforced identically everywhere a TP touches a specific program.
export const assertProgramOwnershipService = async (
   programId: string,
   requestingUserId: string
) => {
   const program = await findProgramById(programId);

   if (!program) {
      throw new AppError(MESSAGES.PROGRAM_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   if (String(program.createdBy) !== String(requestingUserId)) {
      throw new AppError(MESSAGES.ACCESS_DENIED, HTTP_STATUS.FORBIDDEN);
   }

   return program;
};

//get employee data corresponding program
export const getProgramParticipantsService = async (
   programId: string,
   requestingUserId: string
) => {
   await assertProgramOwnershipService(programId, requestingUserId);

   const enrollments = await getProgramParticipantsRepo(programId);

   return enrollments.map((enrollment) =>
      mapUserBasicDetail(enrollment.employeeId as any)
   );

};
