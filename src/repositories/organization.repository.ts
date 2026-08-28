import { Types } from "mongoose";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { organizationModel } from "../models/organization.model.js";
import { CreateOrganization } from "../types/organization.js";
import { AppError } from "../utils/appError.js";
import { IOrganization } from "../interfaces/organization.interface.js";
import { escapeRegex } from "../utils/escapeRegex.js";


export const createOrganization = async (
   data: CreateOrganization
): Promise<IOrganization> => {
   return await organizationModel.create(data);
};

export const updateOrganizationPolicy = async (
   organizationId: string,
   data: {
      policy?: CreateOrganization["policy"];
      policyAssignments?: CreateOrganization["policyAssignments"];
   }
): Promise<void> => {
 
   const setFields: Record<string, unknown> = {};
   for (const [key, value] of Object.entries(data.policy ?? {})) {
      setFields[`policy.${key}`] = value;
   }
   for (const [key, value] of Object.entries(data.policyAssignments ?? {})) {
      setFields[`policyAssignments.${key}`] = value;
   }

   const organization =
      await organizationModel.findByIdAndUpdate(
         organizationId,
         { $set: setFields },
         {
            new: true,
            runValidators: true,
         }
      );

   if (!organization) {
      throw new AppError(
         MESSAGES.ORG_NOT_FOUND,
         HTTP_STATUS.NOT_FOUND
      );
   }
};

export const updateOrganizationDetails = async (
   organizationId: string,
   data: Partial<Pick<IOrganization, "name" | "slug" | "orgType" | "status">>
): Promise<IOrganization | null> => {
   return organizationModel.findByIdAndUpdate(
      organizationId,
      { $set: data },
      { new: true, runValidators: true }
   );
};

export const bulkCreateOrganizations = async (
   organizations: CreateOrganization[]
): Promise<void> => {
   try {
      await organizationModel.insertMany(
         organizations,
         { ordered: false }
      );
   } catch (error: any) {
      if (error.code === 11000) {
         throw new AppError(
            MESSAGES.ORG_EXIST,
            HTTP_STATUS.CONFLICT
         );
      }

      throw error;
   }
};

export const findOrganizationBySlugs = async (
   slugs: string[]
) => {
   return organizationModel
      .find({
         slug: { $in: slugs },
      })
      .lean();
};

export const findOneOrgBySlug = async (
   slug: string
) => {
   return organizationModel.findOne({ slug }).lean();
};

export const findOrgById = async (
   id: Types.ObjectId
): Promise<IOrganization | null> => {
   return organizationModel.findById(id)
}

export const getOrganizationsRepo = async (
   page: number,
   limit: number,
   search?: string,
   orgId?: Types.ObjectId
): Promise<{ organizations: IOrganization[]; total: number }> => {
   const filter: Record<string, unknown> = {};

   if (orgId) {
      filter._id = orgId;
   }

   if (search) {
      const escaped = escapeRegex(search);
      filter.$or = [
         { name: { $regex: escaped, $options: "i" } },
         { slug: { $regex: escaped, $options: "i" } },
      ];
   }

   const [organizations, total] = await Promise.all([
      organizationModel
         .find(filter)
         .select("name slug orgType status createdAt")
         .sort({ createdAt: -1 })
         .skip((page - 1) * limit)
         .limit(limit)
         .lean(),
      organizationModel.countDocuments(filter),
   ]);

   return { organizations: organizations as unknown as IOrganization[], total };
};

