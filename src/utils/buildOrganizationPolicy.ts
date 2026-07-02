import { AssignmentMode } from "../constants/enum.js";

interface PolicyInput {
  managerLevels: number;
  managerMinLevel: number;
  trainingDeptLevels: number;
  trainingDeptMinLevel: number;
  osdLevels: number;
  osdMinLevel: number;
  tourFormLevels: number;
  tourFormMinLevel: number;
  reimbursementLevels: number;
  reimbursementMinLevel: number;
}

export const buildOrganizationPolicy = (
  row: PolicyInput
) => ({
  managerApproval: {
    enabled: true,
    levels: row.managerLevels,
    minLevelToApprove:
      row.managerMinLevel,
    assignmentMode:
      AssignmentMode.ASSIGNED,
  },

  trainingDeptApproval: {
    enabled: true,
    levels:
      row.trainingDeptLevels,
    minLevelToApprove:
      row.trainingDeptMinLevel,
    assignmentMode:
      AssignmentMode.POOL,
  },

  osdReview: {
    enabled: true,
    levels: row.osdLevels,
    minLevelToApprove:
      row.osdMinLevel,
    assignmentMode:
      AssignmentMode.POOL,
  },

  tourForm: {
    enabled: true,
    levels: row.tourFormLevels,
    minLevelToApprove: row.tourFormMinLevel,
    assignmentMode:
      AssignmentMode.ASSIGNED,
  },

  reimbursement: {
    enabled: true,
    levels: row.reimbursementLevels,
    minLevelToApprove: row.reimbursementMinLevel,
    assignmentMode:
      AssignmentMode.POOL,
  },

  tourApproval: {
    managerApprovalRequired: true,
    osdApprovalRequired: true,
  },

  reimbursementApproval: {
    managerApprovalRequired: true,
    osdApprovalRequired: true,
  },
});