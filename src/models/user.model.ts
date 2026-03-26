import mongoose, { Schema } from "mongoose";
import { IUser } from "../interfaces/user.interface.js";


const userSchema = new Schema<IUser>({
  username: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    // required: true,
  },
  approval_status: {
    type: String,
    enum: ["approved", "dismissed", "pending"],
    default: "pending"
  },
  status: {
    type: String,
    enum: ["active", "deactive"],
    default: "active"
  },
  description:{
    type:String,
  }
}, {
  timestamps: true,
});

export default mongoose.model<IUser>("User", userSchema);