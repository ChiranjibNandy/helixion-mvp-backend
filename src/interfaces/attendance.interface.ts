import { Document, Types } from "mongoose";

export interface IParticipantAttendance {
   participantId: Types.ObjectId;
   status: "present" | "absent";
}

export interface IAttendance extends Document {
   programId: Types.ObjectId;
   date: Date;
   participants: IParticipantAttendance[];
}