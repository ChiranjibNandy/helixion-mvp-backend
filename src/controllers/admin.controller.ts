import { Request, Response, NextFunction } from "express";
import { MESSAGES } from "../constants/messages.js";
import {
  approveUserAndAddRoleService,
  getPendingRegistrationsService,
  deactivateUserService,
  bulkProcessUsersService,
} from "../services/admin.service.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

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

export const bulkProcessUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { users } = req.body;

    const result = await bulkProcessUsersService(users);

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.BATCH_USERS_PROCESSED,
      data: { count: result?.modifiedCount || 0 },
    });
  } catch (error) {
    next(error);
  }
};