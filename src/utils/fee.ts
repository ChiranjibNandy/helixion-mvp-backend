import { STAY_TYPE_KEY } from "../constants/enum.js";
import { IProgram } from "../interfaces/program.interface.js";

export function resolveEnrollmentFee(
  program: Pick<IProgram, "singleOccupancyFee" | "twinSharingFee" | "nonResidentialFee">,
  stayType: STAY_TYPE_KEY
): number {
  switch (stayType) {
    case STAY_TYPE_KEY.SINGLE_OCCUPANCY: return program.singleOccupancyFee ?? 0;
    case STAY_TYPE_KEY.TWIN_SHARING:     return program.twinSharingFee     ?? 0;
    case STAY_TYPE_KEY.NON_RESIDENTIAL:  return program.nonResidentialFee  ?? 0;
    default:                             return 0;
  }
}
