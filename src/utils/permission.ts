import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { IUser } from "../interfaces/user.interface.js";
import {  hasReportingEmployees } from "../repositories/user.repository.js";
import { AppError } from "./appError.js";

export const canRecommend = async (user: IUser): Promise<boolean> => {
   if (!user.orgId) {
      throw new AppError(
         MESSAGES.ORG_NOT_FOUND,
         HTTP_STATUS.NOT_FOUND
      );
   }
   const exists = await hasReportingEmployees(
      user.orgId,
      user._id
   );

   return !!exists;
};