import { APPROVAL_STATUS } from "../constants/enum.js";

export type ApprovalStatus = typeof APPROVAL_STATUS[keyof typeof APPROVAL_STATUS];