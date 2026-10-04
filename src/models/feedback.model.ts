import mongoose, { Schema } from "mongoose";

export interface IFeedback {
   programId: mongoose.Types.ObjectId;
   employeeId: mongoose.Types.ObjectId;
   rating: number;
   remark?: string;
   createdAt?: Date;
   updatedAt?: Date;
}

const feedbackSchema = new Schema<IFeedback>(
   {
      programId: {
         type: Schema.Types.ObjectId,
         ref: "Program",
         required: true,
      },

      employeeId: {
         type: Schema.Types.ObjectId,
         ref: "User",
         required: true,
      },

      rating: {
         type: Number,
         required: true,
         min: 1,
         max: 5,
      },

      remark: {
         type: String,
         trim: true,
         default: "",
      },
   },
   {
      timestamps: true,
   }
);

feedbackSchema.index(
   { programId: 1, employeeId: 1 },
   {
      unique: true,
      name: "unique_program_employee_feedback",
   }
);

feedbackSchema.index({ employeeId: 1 });
feedbackSchema.index({ programId: 1 });

export default mongoose.model<IFeedback>(
   "Feedback",
   feedbackSchema
);