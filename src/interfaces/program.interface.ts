import { Types } from "mongoose";
import { PROGRAM_STATUS, STAY_TYPE } from "../constants/enum.js";

export interface IProgram {
  _id?: Types.ObjectId
  title: string;
  startDate: Date;
  endDate?: Date;
  venue?: string;
  isResidential?: boolean;
  stayType?: STAY_TYPE.SINGLE | STAY_TYPE.TWIN;
  singleOccupancyFee?: number;
  twinSharingFee?: number;
  nonResidentialFee?: number;
  brochureUrl?: string;
  minParticipants?: number;
  maxParticipants?: number;
  status: PROGRAM_STATUS.DRAFT | PROGRAM_STATUS.PUBLISHED;
  createdAt: Date;
  updatedAt: Date;
}