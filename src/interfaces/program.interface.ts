import { Types } from "mongoose";
import { PROGRAM_SAVED_STATUS, STAY_TYPE } from "../constants/enum.js";

export interface IProgram {
  _id?: Types.ObjectId
  title: string;
  startDate: Date;
  endDate?: Date;
  venue?: string;
  singleOccupancyFee?: number;
  twinSharingFee?: number;
  nonResidentialFee?: number;
  brochureUrl?: string;
  minParticipants?: number;
  maxParticipants?: number;
  status: PROGRAM_SAVED_STATUS.DRAFT | PROGRAM_SAVED_STATUS.PUBLISHED;
  training_providerId: Types.ObjectId;
  batchId?:string
  createdAt: Date;
  updatedAt: Date;
}