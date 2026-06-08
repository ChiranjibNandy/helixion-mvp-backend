import { NextFunction, Request, Response } from "express";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { AppError } from "../utils/appError.js";
import {
  getEmployeeDashboardService,
  getAvailableProgramsService,
  enrollInProgramService,
} from "../services/employee.service.js";
import { ENROLLMENT_SOURCE, STAY_TYPE_KEY } from "../constants/enum.js";

interface GetProgramsQuery {
  page:      number;
  limit:     number;
  search?:   string;
  venue?:    string;
  fromDate?: string;
  toDate?:   string;
}

// GET /api/employee/dashboard
export const getEmployeeDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError(MESSAGES.USER_ID_REQUIRED, HTTP_STATUS.UNAUTHORIZED);

    const dashboard = await getEmployeeDashboardService(userId);

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.DASHBOARD_DATA_FETCH,
      data: dashboard,
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
    const { page, limit, search, venue, fromDate, toDate } =
      req.query as unknown as GetProgramsQuery;

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

    const programId           = req.params.id as string;
    const { stayType, notes } = req.body as { stayType: STAY_TYPE_KEY; notes?: string };

    const userAgent = req.headers["user-agent"] ?? "";
    const source    = /mobile|android|iphone/i.test(userAgent)
      ? ENROLLMENT_SOURCE.MOBILE
      : ENROLLMENT_SOURCE.WEB;

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
