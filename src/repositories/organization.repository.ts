import { IOrganization } from "../interfaces/organization.interface.js";
import Organization from "../models/organization.model.js";

export const createOrganizationRepo = async (
  payload: IOrganization
) => {
  return Organization.create(payload);
};

export const findOrganizationBySlugRepo = async (
  slug: string
) => {
  return Organization.findOne({ slug });
};

export const findOrganizationByIdRepo = async (
  id: string
) => {
  return Organization.findById(id);
};

export const updateOrganizationPolicyRepo = async (
  organizationId: string,
  policy: Partial<IOrganization["policy"]>
) => {
  return Organization.findByIdAndUpdate(
    organizationId,
    {
      $set: Object.entries(policy).reduce(
        (acc, [key, value]) => ({
          ...acc,
          [`policy.${key}`]: value,
        }),
        {}
      ),
    },
    { new: true }
  );
};