import { getPublishedProgramsRepository } from "../repositories/program.repository.js";
import { GetPublishedProgramsServiceParams } from "../types/program.js";

export const getPublishedProgramsService = async ({
   userId,
   page = 1,
   limit = 10,
}: GetPublishedProgramsServiceParams) => {
   return await getPublishedProgramsRepository({
      trainingProviderId: userId,
      page,
      limit,
   });
};