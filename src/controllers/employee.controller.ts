import { NextFunction, Request, Response } from "express";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { AppError } from "../utils/appError.js";
import {
   getEmployeeDashboardService,
   getEmployeeProgramsListService,
   getEmployeeProgramByIdService,
   enrollInProgramService,
   getEmployeeEnrollmentsService,
   getEnrollmentDetailsService,
   updateTravelDetailsService,
   submitEnrollmentService
} from "../services/employee.service.js";

/**
 * Fetch employee dashboard enrollments and available active programs.
 *
 * Route:
 * GET /api/employee/dashboard
 *
 * Access:
 * Employee (Authenticated)
 *
 * Request:
 * - userId (from authenticated token / middleware)
 *
 * Returns:
 * - summary
 * - Chart Data (approvalStats)
 * - available active programs
 */
export const getEmployeeDashboard =
   async (req: Request, res: Response, next: NextFunction) => {
      try {
         const userId = req.userId;

         if (!userId) {
            throw new AppError(
               MESSAGES.USER_ID_REQUIRED,
               HTTP_STATUS.UNAUTHORIZED
            );
         }

         const dashboard =
            await getEmployeeDashboardService(userId);

         return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: MESSAGES.DASHBOARD_DATA_FETCH,
            data: dashboard
         });
      } catch (error) {
         next(error);
      }
   };

export const getEmployeeProgramsList = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const { page, limit, search, venue, fromDate, toDate } = req.query as any;

      const result = await getEmployeeProgramsListService({
         page,
         limit,
         search,
         venue,
         fromDate,
         toDate
      });

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.PUBLISHED_PROGRAM_FETCH,
         data: result
      });
   } catch (error) {
      next(error);
   }
};

export const getEmployeeProgramById = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const { id } = req.params;
      const program = await getEmployeeProgramByIdService(String(id));

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.PUBLISHED_PROGRAM_FETCH,
         data: program
      });
   } catch (error) {
      next(error);
   }
};

export const enrollInProgram = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const userId = req.userId;
      if (!userId) {
         throw new AppError(MESSAGES.USER_ID_REQUIRED, HTTP_STATUS.UNAUTHORIZED);
      }

      const { id: programId } = req.params;
      const { stayType, notes, travelAndStay } = req.body;

      const result = await enrollInProgramService(
         userId,
         String(programId),
         stayType,
         notes,
         travelAndStay
      );

      return res.status(HTTP_STATUS.CREATED).json({
         success: true,
         message: MESSAGES.ENROLLMENT_CREATED,
         data: result
      });
   } catch (error) {
      next(error);
   }
};

export const getEmployeeEnrollments = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const userId = req.userId;
      if (!userId) {
         throw new AppError(MESSAGES.USER_ID_REQUIRED, HTTP_STATUS.UNAUTHORIZED);
      }

      const enrollments = await getEmployeeEnrollmentsService(userId);

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.ACTIVE_ENROLL_AND_AVAILABLE_PROGRAM,
         data: enrollments
      });
   } catch (error) {
      next(error);
   }
};

export const getEnrollmentDetails = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const userId = req.userId;
      if (!userId) {
         throw new AppError(MESSAGES.USER_ID_REQUIRED, HTTP_STATUS.UNAUTHORIZED);
      }

      const { id } = req.params;
      const enrollmentObj = await getEnrollmentDetailsService(String(id), userId);

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.ACTIVE_ENROLL_AND_AVAILABLE_PROGRAM,
         data: enrollmentObj
      });
   } catch (error) {
      next(error);
   }
};

export const updateTravelDetails = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const userId = req.userId;
      if (!userId) {
         throw new AppError(MESSAGES.USER_ID_REQUIRED, HTTP_STATUS.UNAUTHORIZED);
      }

      const { id: enrollmentId } = req.params;
      const travelAndStay = req.body;

      const result = await updateTravelDetailsService(
         userId,
         String(enrollmentId),
         travelAndStay
      );

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.ACTIVE_ENROLL_AND_AVAILABLE_PROGRAM,
         data: result
      });
   } catch (error) {
      next(error);
   }
};

export const submitEnrollment = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const userId = req.userId;
      if (!userId) {
         throw new AppError(MESSAGES.USER_ID_REQUIRED, HTTP_STATUS.UNAUTHORIZED);
      }

      const { id: enrollmentId } = req.params;

      const result = await submitEnrollmentService(
         userId,
         String(enrollmentId)
      );

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.ACTIVE_ENROLL_AND_AVAILABLE_PROGRAM,
         data: result
      });
   } catch (error) {
      next(error);
   }
};
