import { IUserWithOrganization } from "../interfaces/user.interface.js";

export interface IPermission {
   canEnroll: boolean;
   canRecommend: boolean;
   canApproveEnrollment: boolean;
   canReviewTrainingDept: boolean;
   canApproveTrainingDept: boolean;
   canReviewOsd: boolean;
   canApproveOsd: boolean;

}

export interface LoginResponse {
   user: IUserWithOrganization;
   permissions: IPermission
}