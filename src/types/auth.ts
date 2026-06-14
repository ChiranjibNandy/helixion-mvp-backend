import { IUser } from "../interfaces/user.interface.js";

export interface LoginResponse {
   user: IUser;
   permissions: {
      canEnroll: boolean;
      canApproveEnrollment: boolean;
      canRecommend: boolean;
      canReviewTrainingDept: boolean;
      canApproveTrainingDept: boolean;
      canReviewOsd: boolean;
      canApproveOsd: boolean;
   };
}