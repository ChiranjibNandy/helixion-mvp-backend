import { Request, Response, NextFunction } from "express";
import { MESSAGES } from "../constants/messages.js";
import { approveUserAndAddRoleService, getPendingRegistrationsService } from "../services/admin.service.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { TypeOf } from "zod/v3";
import { approveUserBodySchema, approveUserParamsSchema } from "../validators/admin.validator.js";

// Retrieve a list of users with pending registration status for admin, supporting pagination and limit
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

    const user = await approveUserAndAddRoleService(String(id), role, description);

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.USER_APPROVED_SUCCESSFULLY,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};