import mongoose, { Schema } from "mongoose";
import { IUser } from "../interfaces/user.interface.js";
import { ORG_ROLE, USER_STATUS } from "../constants/enum.js";

const managerChainEntrySchema = new Schema(
   {
      userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
      level:  { type: Number, required: true },   // 1 = direct manager, 2 = skip-level, …
   },
   { _id: false }
);

const userSchema = new Schema<IUser>(
   {
      orgId: {
         type:  Schema.Types.ObjectId,
         index: true,
         // optional — training_provider users don't belong to a corporate org
      },

      orgType: {
         type: String,
         enum: ["corporate"],
      },

      employeeCode: {
         type:  String,
         trim:  true,
         sparse: true,   // unique within org but not globally required
      },

      name: {
         type:     String,
         required: true,
         trim:     true,
      },

      email: {
         type:     String,
         required: true,
         unique:   true,
         lowercase: true,
         trim:     true,
      },

      mobile: {
         type: String,
         trim: true,
      },

      placeOfPosting: {
         type: String,
         trim: true,
      },

      passwordHash: {
         type:     String,
         required: true,
      },

      mustChangePassword: {
         type:    Boolean,
         default: false,
      },

      orgRole: {
         type:    String,
         enum:    [...Object.values(ORG_ROLE), "training-provider"], // keep legacy hyphenated value during migration
         index:   true,
      },

      status: {
         type:    String,
         enum:    Object.values(USER_STATUS),
         default: USER_STATUS.ACTIVE,
         index:   true,
      },

      hierarchy: {
         level: { type: Number, default: 0 }, // 0 = individual contributor
         managerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
         managerChain: {
            type:    [managerChainEntrySchema],
            default: [],
         },
      },

      officeRoles: {
         trainingDept: {
            enabled: { type: Boolean, default: false },
            level:   { type: Number, default: null },  // 1 = junior, 2 = senior
         },
         osd: {
            enabled: { type: Boolean, default: false },
            level:   { type: Number, default: null },
         },
      },
   },
   {
      timestamps: true,
   }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Tenant-scoped lookups
userSchema.index({ orgId: 1, status: 1 });
userSchema.index({ orgId: 1, orgRole: 1 });

// Manager queries — "find all employees where I am in their managerChain"
userSchema.index({ orgId: 1, "hierarchy.managerId": 1 });

// Office-role officer pool lookups
userSchema.index({ orgId: 1, "officeRoles.trainingDept.enabled": 1, "officeRoles.trainingDept.level": 1 });
userSchema.index({ orgId: 1, "officeRoles.osd.enabled": 1, "officeRoles.osd.level": 1 });

// Employee code within org (unique per org, not globally)
userSchema.index({ orgId: 1, employeeCode: 1 }, { unique: true, sparse: true });

export default mongoose.model<IUser>("User", userSchema);