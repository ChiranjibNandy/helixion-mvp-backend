import { Types } from "mongoose";

export interface IEnrollmentProgramSnapshot {
  title: string;
  startDate?: Date;
  endDate?: Date;
  venue?: string;
  training_providerId: Types.ObjectId;
}

// mongoose schema 
export interface IEnrollment {
  _id?: Types.ObjectId;

  userId:    Types.ObjectId;
  programId: Types.ObjectId;
  status:    string; // ENROLLMENT_STATUS

  stayType: string; // STAY_TYPE_KEY

  feeAmount: number;
  currency:  string; // CURRENCY

  programSnapshot: IEnrollmentProgramSnapshot;

  approvalStatus: string; // ENROLLMENT_APPROVAL_STATUS

  locationMatched: boolean;

  source: string; // ENROLLMENT_SOURCE
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}
