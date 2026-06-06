import { Types } from "mongoose";


export interface IEnrollmentProgramSnapshot {
  title: string;
  startDate?: Date;
  endDate?: Date;
  venue?: string;
  training_providerId: Types.ObjectId;
}

export interface IEnrollment {
  _id?: Types.ObjectId;

  
  userId:    Types.ObjectId;
  programId: Types.ObjectId;
  status:    string;               // active | pending | completed | cancelled

  // accomodation
  stayType: string;                // single_occupancy | twin_sharing | non_residential

  // fee
  feeAmount: number;               // fee locked at enrollment time (prevents price change disputes)
  currency:  string;               // default INR

  // program snapshot
  programSnapshot: IEnrollmentProgramSnapshot;

  // workflow
  approvalStatus: string;          // pending_approval | approved | rejected | not_required

  // location
  locationMatched: boolean;        // true when user's location matches the program venue

  // traceability
  source: string;                  // web | mobile | api | admin
  notes?: string;                  // optional employee notes at enrollment time

  createdAt: Date;
  updatedAt: Date;
}
