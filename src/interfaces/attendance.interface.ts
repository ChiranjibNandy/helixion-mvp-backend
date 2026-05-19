import { Document, Types } from "mongoose";
import { ATTENDANCE_STATUS } from "../constants/enum.js";

export interface IParticipantAttendance {
   participantId: Types.ObjectId;
    present_status: ATTENDANCE_STATUS;
}

export interface IAttendance extends Document {
   programId: Types.ObjectId;
   date: Date;
   participants: IParticipantAttendance[];
}