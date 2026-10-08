import z from "zod";

export const generateInvoiceBodySchema = z.object({
  companies: z
    .array(
      z.object({
        companyOrgId: z.string().length(24),
        gstin: z.string().trim().min(1),
        stateCode: z.string().trim().regex(/^\d{2}$/),
        stateName: z.string().trim().min(1),
        discountPercent: z.number().min(0).max(100).default(0),
      })
    )
    .min(1),
});

export const invoiceProgramParamsSchema = z.object({
  id: z.string().length(24),
});

export const invoiceIdParamsSchema = z.object({
  invoiceId: z.string().length(24),
});
