import { Request, Response, NextFunction } from "express";
import { MESSAGES } from "../constants/messages.js";
import { approveUserService } from "../services/admin.service.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

interface ApproveUserParams {
   userId: string;
}

export const approveUser = async (
   req: Request<ApproveUserParams>,
   res: Response,
   next: NextFunction
) => {

   try {

      const { userId } = req.params;

      const user = await approveUserService(userId);

      res.status(HTTP_STATUS.OK).json({
         success: true,
         message: MESSAGES.USER_APPROVED_SUCCESSFULLY,
         data: user
      });

   } catch (error) {
      next(error);
   }

};