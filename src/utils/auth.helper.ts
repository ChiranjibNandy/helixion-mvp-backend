import { ORG_ROLE } from "../constants/enum.js";
import { JwtPayloadType } from "./jwt.js";

/**
 * Builds the RBAC payload for the JWT token.
 * Extracted from auth.controller to keep business logic separate.
 */
export const buildAuthPayload = (user: any): JwtPayloadType => {
  const isManager = user.orgRole === ORG_ROLE.EMPLOYEE && user.hierarchy && user.hierarchy.level > 0;
  
  return {
    userId:             user._id!.toString(),
    name:               user.name,
    email:              user.email,
    orgId:              user.orgId?.toString(),
    orgRole:            user.orgRole,
    officeRoles:        user.officeRoles,
    mustChangePassword: user.mustChangePassword,
    isManager:          !!isManager,
  };
};
