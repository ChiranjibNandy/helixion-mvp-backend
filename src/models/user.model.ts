import mongoose, { Schema } from "mongoose";
import { IUser } from "../interfaces/user.interface.js";
import { APPROVAL_STATUS, USER_STATUS } from "../constants/enum.js";

const managerChainSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    level: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

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
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: "Organization",
    required: false,
  },
  approval_status: {
    type: String,
    enum: Object.values(APPROVAL_STATUS),
    default: APPROVAL_STATUS.PENDING
  },
  status: {
    type: String,
    enum: Object.values(USER_STATUS),
    default: USER_STATUS.ACTIVE
  },
  description: {
    type: String,
  },
  location: {
    type: String,
  },
  hierarchy: {
    managerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    managerChain: {
      type: [managerChainSchema],
      default: [],
    },
  },
}, {
  timestamps: true,
});


userSchema.index({ role: 1 });

userSchema.index({ approval_status: 1 });

userSchema.index({ status: 1 });

userSchema.index({ role: 1, approval_status: 1 });

export default mongoose.model<IUser>("User", userSchema);