import { AssignmentMode } from "../constants/enum.js";

interface PolicyInput {
  managerLevels: number;
  managerMinLevel: number;
  trainingDeptLevels: number;
  trainingDeptMinLevel: number;
  osdLevels: number;
  osdMinLevel: number;
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
    approvalStage: {
      enabled: true,
      levels: 1,
      minLevelToApprove: 1,
      assignmentMode:
        AssignmentMode.ASSIGNED,
    },
  },

  reimbursement: {
    enabled: true,
    approvalStage: {
      enabled: true,
      levels: 2,
      minLevelToApprove: 2,
      assignmentMode:
        AssignmentMode.POOL,
    },
  },
});