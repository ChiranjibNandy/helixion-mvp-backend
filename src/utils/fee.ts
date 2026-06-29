import { STAY_TYPE } from "../constants/enum.js";
import { IProgram } from "../interfaces/program.interface.js";

/**
 * Resolves the fee for a given stayType from the program's stayOptions array.
 * Replaces the old flat fee fields (singleOccupancyFee, twinSharingFee, nonResidentialFee).
 */
export function resolveEnrollmentFee(
   program: Pick<IProgram, "stayOptions">,
   stayType: STAY_TYPE | string
): number {
   const option = program.stayOptions?.find((o) => o.type === stayType);
   return option?.price ?? 0;
}
