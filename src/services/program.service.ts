import { mapUserBasicDetail } from "../mapper/user.mapper.js";
import { getProgramParticipantsRepo } from "../repositories/enrollment.repository.js";
import { getPublishedProgramsRepo } from "../repositories/program.repository.js";
import { GetPublishedProgramsServiceParams } from "../types/program.js";

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



//get employee data corresponding program
export const getProgramParticipantsService = async (
   programId: string
) => {
   const enrollments = await getProgramParticipantsRepo(programId);

   return enrollments.map((enrollment) =>
      mapUserBasicDetail(enrollment.userId as any)
   );
};
