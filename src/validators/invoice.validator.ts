import z from "zod";

// One-click generation, per company: GSTIN/state come from the
// Organization's billing record (populated elsewhere). An optional override
// is still accepted in case that data isn't set yet.
export const generateInvoiceBodySchema = z.object({
  companyOrgId: z.string().length(24),
  gstin: z.string().trim().optional(),
  stateCode: z.string().trim().regex(/^\d{2}$/).optional(),
  stateName: z.string().trim().optional(),
  discountPercent: z.number().min(0).max(100).default(0),
});

export const invoiceProgramParamsSchema = z.object({
  id: z.string().length(24),
});

export const invoiceIdParamsSchema = z.object({
  invoiceId: z.string().length(24),
});
