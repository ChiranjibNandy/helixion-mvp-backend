import feedbackModel, { IFeedback } from "../models/feedback.model.js";
import { toObjectId } from "../utils/mongo.js";

export const createFeedbackRepo = async (
   data: Partial<IFeedback>
): Promise<IFeedback> => {
   return await feedbackModel.create(data);
};

export const findFeedbackByProgramAndEmployeeRepo = async (
   programId: string,
   employeeId: string
): Promise<IFeedback | null> => {
   return await feedbackModel.findOne({
      programId:toObjectId(programId),
      employeeId:toObjectId(employeeId),
   });
};