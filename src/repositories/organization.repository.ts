import { Types } from "mongoose";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { organizationModel } from "../models/organization.model.js";
import { CreateOrganization } from "../types/organization.js";
import { AppError } from "../utils/appError.js";
import { IOrganization } from "../interfaces/organization.interface.js";


export const createOrganization = async (
   data: CreateOrganization
): Promise<void> => {
   await organizationModel.create(data);
};

export const updateOrganizationPolicy = async (
   organizationId: string,
   data: {
      policy: CreateOrganization["policy"];
      policyAssignments: CreateOrganization["policyAssignments"];
   }
): Promise<void> => {
   const organization =
      await organizationModel.findByIdAndUpdate(
         organizationId,
         {
            $set: {
               policy: data.policy,
               policyAssignments:
                  data.policyAssignments,
            },
         },
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

export const findOrganizationsBySlugs = async (
   slugs: string[]
) => {
   return organizationModel
      .find({
         slug: { $in: slugs },
      })
      .lean();
};

export const findOrganizationBySlug = async (
   slug: string
) => {
   return organizationModel.findOne({ slug }).lean();
};

export const findOrganizationById = async (id: Types.ObjectId):Promise<IOrganization | null> => {
   return organizationModel.findById(id)
}