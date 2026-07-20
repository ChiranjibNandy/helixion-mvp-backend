import { STAY_TYPE } from "../constants/enum.js";

// The create/update/bulk-CSV request shapes still use the legacy flat
// fields (`venue`, `singleOccupancyFee`, `twinSharingFee`,
// `nonResidentialFee`) — the Program model replaced these with
// `venueName` and a `stayOptions: [{type, price}]` array (see the
// "Replaces..." comment on that field in program.model.ts), but nothing
// ever translated the request shape into the model shape. Since Mongoose
// silently drops fields not on the schema, `venue`/`city` were previously
// never actually persisted. This is the single place that translation
// happens, so create/update/bulk can't drift out of sync with each other.
export const mapProgramInputToModelFields = (data: Record<string, any>) => {
   const {
      venue,
      singleOccupancyFee,
      twinSharingFee,
      nonResidentialFee,
      ...rest
   } = data;

   const stayOptions: { type: STAY_TYPE; price: number }[] = [];
   if (singleOccupancyFee != null) {
      stayOptions.push({ type: STAY_TYPE.SINGLE_OCCUPANCY, price: singleOccupancyFee });
   }
   if (twinSharingFee != null) {
      stayOptions.push({ type: STAY_TYPE.TWIN_SHARING, price: twinSharingFee });
   }
   if (nonResidentialFee != null) {
      stayOptions.push({ type: STAY_TYPE.NON_RESIDENTIAL, price: nonResidentialFee });
   }

   return {
      ...rest,
      ...(venue !== undefined ? { venueName: venue } : {}),
      ...(stayOptions.length > 0 ? { stayOptions } : {}),
   };
};
