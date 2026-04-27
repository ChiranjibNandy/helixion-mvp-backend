import { Request, Response, NextFunction } from "express";
import { MESSAGES } from "../constants/messages.js";
import {
  approveUserAndAddRoleService,
  getPendingRegistrationsService,
  deactivateUserService,
  batchCreateUsersService,
  getUsersService,
} from "../services/admin.service.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

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

    await approveUserAndAddRoleService(String(id), role, description);

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
 * Bulk create multiple users.
 *
 * Route:
 * POST /users/batch
 *
 * Body:
 * - users[]
 *
 * Access:
 * Admin only
 *
 * Returns:
 * Created users summary
 */

export const batchCreateUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { users } = req.body;

    const result = await batchCreateUsersService(users);

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: MESSAGES.BATCH_USERS_CREATED,
      data: { count: result.length },
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
    res: Response
  ) => {
    const { page, limit, search } = req.query

    const users =
      await getUsersService(Number(page), Number(limit), String(search));

    res.status(HTTP_STATUS.OK).json({
      message:
        MESSAGES.USERS_FETCHED,
      data: users
    });

  };