import { getActiveEnrollmentsRepository } from "../repositories/enrollment.repository.js";
import { getAvailableProgramsRepository } from "../repositories/program.repository.js";
import { getUserByIdRepository } from "../repositories/user.repository.js";

// Service to retrieve dashboard data including active enrollments and available programs
export const getDashboardEnrollmentsService =
   async (userId:string) => {

      const enrollments =
         await getActiveEnrollmentsRepository(userId);

      const availablePrograms =
         await getAvailableProgramsRepository();

      return {
         enrollments,
         availablePrograms
      };
   };