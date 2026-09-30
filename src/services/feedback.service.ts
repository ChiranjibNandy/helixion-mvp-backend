import mongoose from "mongoose";
import { findCompletedProgramsByEmployeeRepo } from "../repositories/attendanceRecord.repository.js";
import { AddFeedbackDto } from "../dtos/feedback.dto.js";
import { AppError } from "../utils/appError.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { createFeedbackRepo, findFeedbackByProgramAndEmployeeRepo } from "../repositories/feedback.repository.js";
import { MESSAGES } from "../constants/messages.js";
import { toObjectId } from "../utils/mongo.js";

export const getCompletedFeedbackProgramsService = async (
   employeeId: string
) => {
   const programs = await findCompletedProgramsByEmployeeRepo(employeeId);
   return programs.map((program) => ({
      _id: program._id,
      title: program.title,
   }));
};

export const addFeedbackService = async (
   employeeId: string,
   payload: AddFeedbackDto
) => {
   const { programId, rating, remark } = payload;

   // Check whether employee completed the program
   const completedPrograms =
      await findCompletedProgramsByEmployeeRepo(employeeId);

   const completedProgram = completedPrograms.some(
      (program) => String(program._id) === programId.toString()
   );

   if (!completedProgram) {
      throw new AppError(
         MESSAGES.NOT_ELIGIBLE_SUBMIT_FEEDBACK,
         HTTP_STATUS.FORBIDDEN
      );
   }

   const existingFeedback =
      await findFeedbackByProgramAndEmployeeRepo(
         programId,
         employeeId
      );

   if (existingFeedback) {
      throw new AppError(
         MESSAGES.FEEDBACK_ALREADY_SUBMITTED,
         HTTP_STATUS.CONFLICT
      );
   }

   return await createFeedbackRepo({
      programId: toObjectId(programId),
      employeeId: toObjectId(employeeId),
      rating,
      remark,
   });
};