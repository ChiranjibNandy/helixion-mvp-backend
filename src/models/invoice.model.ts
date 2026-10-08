import mongoose, { Schema, Document, Types } from "mongoose";

export interface IInvoiceLine {
   enrollmentId: Types.ObjectId;
   participantName: string;
   employeeCode?: string;
   stayType: string;
   feePaise: number;
   daysPresent: number;
   totalDays: number;
   attendance: { day: string; status: string }[];
}

export interface IInvoiceCompany {
   companyOrgId: Types.ObjectId;
   companyName: string;
   gstin: string;
   stateCode: string;
   stateName: string;
   discountPercent: number;
   lines: IInvoiceLine[];
   subtotalPaise: number;
   discountPaise: number;
   taxablePaise: number;
   cgstPaise: number;
   sgstPaise: number;
   igstPaise: number;
   totalPaise: number;
}

export interface IInvoice extends Document {
   invoiceNumber: string;
   programId: Types.ObjectId;
   providerId: Types.ObjectId;
   invoiceDate: Date;
   provider: { name: string; gstin: string; pan: string; stateCode: string; stateName: string };
   companies: IInvoiceCompany[];
   subtotalPaise: number;
   discountPaise: number;
   taxablePaise: number;
   cgstPaise: number;
   sgstPaise: number;
   igstPaise: number;
   totalPaise: number;
}

const totalsFields = {
   subtotalPaise: { type: Number, required: true },
   discountPaise: { type: Number, required: true },
   taxablePaise: { type: Number, required: true },
   cgstPaise: { type: Number, required: true },
   sgstPaise: { type: Number, required: true },
   igstPaise: { type: Number, required: true },
   totalPaise: { type: Number, required: true },
};

const invoiceSchema = new Schema<IInvoice>(
   {
      invoiceNumber: { type: String, required: true, unique: true },
      programId: { type: Schema.Types.ObjectId, ref: "Program", required: true, index: true },
      providerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
      invoiceDate: { type: Date, required: true },
      provider: {
         type: new Schema(
            {
               name: { type: String, required: true, trim: true },
               gstin: { type: String, required: true, trim: true },
               pan: { type: String, required: true, trim: true },
               stateCode: { type: String, required: true, trim: true },
               stateName: { type: String, required: true, trim: true },
            },
            { _id: false }
         ),
         required: true,
      },
      companies: {
         type: [
            new Schema(
               {
                  companyOrgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
                  companyName: { type: String, required: true },
                  gstin: { type: String, required: true, trim: true },
                  stateCode: { type: String, required: true, trim: true },
                  stateName: { type: String, required: true, trim: true },
                  discountPercent: { type: Number, min: 0, max: 100, default: 0 },
                  lines: {
                     type: [
                        new Schema(
                           {
                              enrollmentId: { type: Schema.Types.ObjectId, ref: "Enrollment", required: true },
                              participantName: { type: String, required: true },
                              employeeCode: { type: String },
                              stayType: { type: String, required: true },
                              feePaise: { type: Number, required: true, min: 0 },
                              daysPresent: { type: Number, required: true, min: 0 },
                              totalDays: { type: Number, required: true, min: 0 },
                              attendance: {
                                 type: [new Schema({ day: { type: String, required: true }, status: { type: String, required: true } }, { _id: false })],
                                 default: [],
                              },
                           },
                           { _id: false }
                        ),
                     ],
                     default: [],
                  },
                  ...totalsFields,
               },
               { _id: false }
            ),
         ],
         default: [],
      },
      ...totalsFields,
   },
   { timestamps: true }
);

invoiceSchema.index({ programId: 1, createdAt: -1 });

export const invoiceCounterModel = mongoose.model<{ _id: string; seq: number }>(
   "InvoiceCounter",
   new Schema({ _id: { type: String }, seq: { type: Number, default: 0 } }, { versionKey: false })
);

export default mongoose.model<IInvoice>("Invoice", invoiceSchema);
