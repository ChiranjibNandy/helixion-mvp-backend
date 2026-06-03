import { getApprovalStatsRepo, getDashboardSummaryRepo, getListedProgramsRepo } from "../repositories/employee.repository.js";

// Service to retrieve dashboard data including active enrollments and available programs
export const getEmployeeDashboardService = async (userId: string) => {
   const [
      summary,
      approvalStats,
      listedPrograms
   ] = await Promise.all([
      getDashboardSummaryRepo(userId),
      getApprovalStatsRepo(userId),
      getListedProgramsRepo(userId)
   ]);

   return {
      summary,
      approvalStats,
      listedPrograms
   };
};

