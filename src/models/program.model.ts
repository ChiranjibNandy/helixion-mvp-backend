import mongoose, { Schema } from "mongoose";
import { IProgram } from "../interfaces/program.interface.js";

const programSchema = new Schema<IProgram>(
   {
      name: {
         type: String,
         required: true,
         trim: true
      },

      description: {
         type: String,
         required: true
      },

      duration: {
         type: String,
         required: true
      },

      status: {
         type: String,
         enum: ["active", "inactive"],
         default: "active"
      },

      fee: {
         type: Number,
         required: true
      },

      mode: {
         type: String,
         enum: ["online", "offline"],
         required: true
      },
      location:{
         type:String,
         required:true
      },
   },
   {
      timestamps: true
   }
);

export default mongoose.model<IProgram>("Program", programSchema);