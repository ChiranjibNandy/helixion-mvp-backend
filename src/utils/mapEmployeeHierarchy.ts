export const mapEmployeeHierarchy = (
  reportingManager: any,
  skip1: any,
  skip2: any
) => {
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