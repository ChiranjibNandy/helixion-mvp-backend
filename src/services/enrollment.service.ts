import { findEnrollmentByEmployeeIds } from "../repositories/enrollment.repository.js";
import { findEmployeesByManager } from "../repositories/user.repository.js";

export const getRelevantEnrollmentService = async (managerId: string) => {
   // Get all employees whose managerChain contains the logged-in manager
   const employees = await findEmployeesByManager(managerId);

   const employeeIds = employees.map((employee) => employee._id);

   // Get enrollments for those employees
   const enrollments = await findEnrollmentByEmployeeIds(employeeIds);

   const response = enrollments.map((enrollment) => {
      const employee = employees.find(
         (emp) => emp._id.toString() === enrollment.userId.toString()
      );

      if (!employee) {
         return {
            ...enrollment.toObject(),
            canApprove: false,
         };
      }

      // Find the logged-in manager inside the employee's manager chain
      const manager = employee.hierarchy.managerChain.find(
         (m) => m.userId.toString() === managerId
      );

      const managerLevel = manager?.level;


      const minLevelToApprove =
         enrollment.policySnapshot?.managerApproval?.minLevelToApprove ?? 1;


      return {
         ...enrollment.toObject(),
         canApprove:
            managerLevel !== undefined &&
            managerLevel >= minLevelToApprove,
            minLevelToApprove:minLevelToApprove,
            managerLevel:managerLevel
      };
   });

   return response;
}