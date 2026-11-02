import { Types } from "mongoose";
import invoiceModel, { invoiceCounterModel, IInvoice } from "../models/invoice.model.js";

// Enrollment ids already covered by a previously generated invoice for this
// program, so they're excluded from the next billable-enrollments lookup.
export const getInvoicedEnrollmentIdsRepo = async (programId: Types.ObjectId): Promise<Types.ObjectId[]> => {
   return invoiceModel.find({ programId }).distinct("companies.lines.enrollmentId");
};

export const listProgramInvoicesRepo = async (programId: Types.ObjectId) => {
   return invoiceModel.find({ programId }).sort({ createdAt: -1 });
};

export const findInvoiceForProviderRepo = async (invoiceId: string, providerId: string) => {
   return invoiceModel.findOne({ _id: invoiceId, providerId });
};

export const createInvoiceRepo = async (data: Partial<IInvoice>) => {
   return invoiceModel.create(data);
};

// Atomically reserves the next sequential invoice number.
export const nextInvoiceSequenceRepo = async (): Promise<number> => {
   const counter = await invoiceCounterModel.findOneAndUpdate(
      { _id: "invoice" },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" }
   );
   return counter!.seq;
};
