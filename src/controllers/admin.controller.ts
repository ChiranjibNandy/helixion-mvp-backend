import { Request, Response, NextFunction } from "express";
import { MESSAGES } from "../constants/messages.js";
import {
  approveUserAndAddRoleService,
  getPendingRegistrationsService,
  deactivateUserService,
  activateUserService,
  batchCreateUsersService,
  getUsersService,
  searchUsersService,
  createSingleUserService,
  getAdminDashboardStatsService,
  getEmployeeByIdService,
  updateEmployeeService,
} from "../services/admin.service.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { AppError } from "../utils/appError.js";

/**
 * Fetch pending user registrations with pagination.
 *
 * Route:
 * GET /api/admin/registrations
 *
 * Query:
 * - page
 * - limit
 * - search (optional)
 *
 * Access:
 * Admin only
 *
 * Returns:
 * Paginated pending registration users
 * 
 */

export const getPendingRegistrations = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const result =
      await getPendingRegistrationsService(
        page,
        limit
      );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message:
        MESSAGES.PENDING_REGISTRATIONS_FETCHED,
      ...result,
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Approve a pending user and assign role.
 *
 * Route:
 * PATCH /api/admin/users/:id
 *
 * Params:
 * - id (user id)
 *
 * Body:
 * - role
 * - description (optional)
 *
 * Access:
 * Admin only
 *
 * Returns:
 * Updated approved user
 */

export const approveUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { role, description } = req.body;

    await approveUserAndAddRoleService(String(id), role, description, req.userId!);

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.USER_APPROVED_SUCCESSFULLY
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deactivate a user account.
 *
 * Route:
 * PATCH /users/:id/deactivate
 *
 * Params:
 * - id (user id)
 *
 * Access:
 * Admin only
 *
 * Returns:
 * User status updated to deactive
 */

export const deactivateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    await deactivateUserService(String(id), req.userId!);

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.USER_DEACTIVATED_SUCCESSFULLY,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Re-activate a previously deactivated user.
 * Route: PATCH /users/:id/activate  (Admin only, same-org)
 */
export const activateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    await activateUserService(String(id), req.userId!);

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.USER_ACTIVATED_SUCCESSFULLY,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a single employee directly — the only way to create someone with
 * no reporting manager, since bulk upload now requires one on every row.
 * Intended for the one root-of-hierarchy person per org; reportingManagerEmail
 * is optional here.
 *
 * Route:
 * POST /api/admin/users
 *
 * Access:
 * Admin only
 */
export const createSingleUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await createSingleUserService(req.body, req.userId!);
    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: MESSAGES.USER_CREATED_SUCCESSFULLY,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};


export const getEmployeeById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const data = await getEmployeeByIdService(String(id), req.userId!);
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.USERS_FETCHED,
      data,
    });
  } catch (error) {
    next(error);
  }
};


export const updateEmployee = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const data = await updateEmployeeService(String(id), req.body, req.userId!);
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.USER_UPDATED_SUCCESSFULLY,
      data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk import users from CSV upload.
 *
 * Route:
 * POST /api/admin/users/batch
 *
 * Body:
 * - users: [{ email, role, action? }]
 *
 * Actions:
 * - "approve": Create user if email doesn't exist, skip if it does
 * - "update": Update role if email exists, skip if it doesn't
 *
 * Access:
 * Admin only
 *
 * Returns:
 * Created, updated, and skipped counts
 */
export const batchCreateUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.file) {
      throw new AppError("CSV file is required", HTTP_STATUS.BAD_REQUEST);
    }
    if(!req.userId){
      throw new AppError(MESSAGES.ACCESS_DENIED,HTTP_STATUS.FORBIDDEN)
    }

    const result = await batchCreateUsersService(req.file,req.userId);


    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: MESSAGES.BATCH_USERS_PROCESSED,
      data: {
        createdCount: result.createdCount,
        updatedCount: result.updatedCount,
        skippedCount: result.skippedCount,
        skippedEmails: result.skippedEmails,
        skipped: result.skipped,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Fetch all registered users for reset-password flow.
 * Returns only username and email.
 *
 * Route:
 * GET /api/admin/users
 *
 * Query:
 * - page
 * - limit
 * - search
 *
 * Access:
 * Admin only
 *
 * Returns:
 * Paginated users list
 */
export const getUsersController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { page, limit, search } = req.query

      const users =
        await getUsersService(Number(page), Number(limit), search ? String(search) : "", req.userId!);

      res.status(HTTP_STATUS.OK).json({
        message:
          MESSAGES.USERS_FETCHED,
        data: users
      });

    } catch (error) {
      next(error)
    }
  };



/**
 * Admin dashboard summary counts (org-scoped): total users, pending approval,
 * deactivated. Route: GET /api/admin/dashboard/stats  (Admin only)
 */
export const getAdminDashboardStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await getAdminDashboardStatsService(req.userId!);
    return res.status(HTTP_STATUS.OK).json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
};

//search approved User

export const searchUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    // The `search` query-param validator (searchUsersQuerySchema) replaces
    // req.query wholesale with its own parsed output, which only carries
    // page/limit/search — a "q" key here would always be undefined.
    const query = (req.query.search as string) || "";

    const result = await searchUsersService(query, page, limit, req.userId!);

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.USERS_FETCHED,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

