import { NextFunction, Request, Response } from "express";
import {
  getDashboardEnrollmentsService,
  getAvailableProgramsService,
  enrollInProgramService,
} from "../services/employee.service.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { AppError } from "../utils/appError.js";
import { programResponseMapper } from "../mapper/program.mapper.js";

// GET /api/employee/dashboard
export const getDashboardEnrollments = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError(MESSAGES.USER_ID_REQUIRED, HTTP_STATUS.UNAUTHORIZED);

    const { enrollments, availablePrograms } = await getDashboardEnrollmentsService(userId);

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.ACTIVE_ENROLL_AND_AVAILABLE_PROGRAM,
      data: {
        enrollments,
        availablePrograms: programResponseMapper(availablePrograms),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/employee/programs
export const getAvailablePrograms = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const page     = (req.query.page  as any as number) || 1;
    const limit    = (req.query.limit as any as number) || 10;
    const search   = (req.query.search   as string) || undefined;
    const venue    = (req.query.venue    as string) || undefined;
    const fromDate = (req.query.fromDate as string) || undefined;
    const toDate   = (req.query.toDate   as string) || undefined;

    const result = await getAvailableProgramsService({ page, limit, search, venue, fromDate, toDate });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.PROGRAMS_FETCHED,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/employee/programs/:id/enroll
export const enrollInProgram = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError(MESSAGES.USER_ID_REQUIRED, HTTP_STATUS.UNAUTHORIZED);

    const programId = req.params.id as string;
    const { stayType, notes }  = req.body;

    // Detect enrollment source from User-Agent header
    const userAgent = req.headers["user-agent"] ?? "";
    const source    = /mobile|android|iphone/i.test(userAgent) ? "mobile" : "web";

    const result = await enrollInProgramService(userId, programId, stayType, notes, source);

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: MESSAGES.ENROLLMENT_SUCCESSFUL,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
