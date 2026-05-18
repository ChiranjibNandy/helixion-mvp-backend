import { ATTENDANCE_STATUS } from "../constants/enum.js";

export type TakeAttendancePayload = {
   programId: string;
   date: Date;
   participants: {
      participantId: string;
      present_status: ATTENDANCE_STATUS;
   }[];
}

export type UpdateParticipantAttendancePayload = {
   programId: string;
   participantId: string;
   date: Date;
   present_status: string;
}