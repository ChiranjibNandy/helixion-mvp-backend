export interface ManagerChainInput {
  reportingManager?: { _id: any } | null;
  skip1?: { _id: any } | null;
  skip2?: { _id: any } | null;
}


export const buildManagerChain = ({ reportingManager, skip1, skip2 }: ManagerChainInput) => {
  const managerChain = [];

  if (reportingManager) {
    managerChain.push({
      userId: reportingManager._id,
      level: 0,
    });
  }

  if (skip1) {
    managerChain.push({
      userId: skip1._id,
      level: 1,
    });
  }

  if (skip2) {
    managerChain.push({
      userId: skip2._id,
      level: 2,
    });
  }

  return {
    level: managerChain.length,
    managerId: reportingManager?._id,
    managerChain,
  };
};

export const mapEmployeeHierarchy = (
  reportingManager: any,
  skip1: any,
  skip2: any
) => buildManagerChain({ reportingManager, skip1, skip2 });