import { getActiveEnrollmentsRepo } from "../repositories/enrollment.repository.js";
import { getAvailableProgramsRepo } from "../repositories/program.repository.js";

// Service to retrieve dashboard data including active enrollments and available programs
export const getDashboardEnrollmentsService =
   async (userId: string) => {

      const enrollments =
         await getActiveEnrollmentsRepo(userId);

      const availablePrograms =
         await getAvailableProgramsRepo();

      return {
         enrollments,
         availablePrograms
      };
   };

