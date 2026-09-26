import { ATTENDANCE_DAY_STATUS } from "../constants/enum.js";

export type MarkAttendanceDayPayload = {
   programId: string;
   enrollmentId: string;
   date: string;              // "YYYY-MM-DD"
   status: ATTENDANCE_DAY_STATUS | null;
   training_providerId: string;
};

export type UpdateAttendanceNotesPayload = {
   programId: string;
   enrollmentId: string;
   notes: string;
   training_providerId: string;
};

export type GetAttendanceGridQuery = {
   page: number;
   limit: number;
   search: string;
   sortBy?: string;
   sortOrder?: "asc" | "desc";
};
