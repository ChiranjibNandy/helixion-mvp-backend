import { Types } from "mongoose";
import enrollmentModel from "../models/enrollment.model.js";
import invoiceModel, { invoiceCounterModel, IInvoiceCompany, IInvoiceLine } from "../models/invoice.model.js";
import userModel from "../models/user.model.js";
import attendanceRecordModel from "../models/attendanceRecord.model.js";
import { organizationModel } from "../models/organization.model.js";
import { getProgramByIdRepo } from "../repositories/program.repository.js";
import { AppError } from "../utils/appError.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { ENROLLMENT_STAGE, ATTENDANCE_DAY_STATUS } from "../constants/enum.js";
import { PROVIDER_BILLING } from "../constants/providerBilling.js";
import { computeInvoiceTax } from "../utils/invoiceTax.js";

export interface CompanyBillingInput {
   companyOrgId: string;
   gstin: string;
   stateCode: string;
   stateName: string;
   discountPercent: number;
}

const loadProgramForProvider = async (programId: string, providerId: string) => {
   const program = await getProgramByIdRepo(programId, providerId);
   if (!program) throw new AppError(MESSAGES.PROGRAM_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   return program;
};

const loadBillableEnrollments = async (programId: Types.ObjectId, invoicedIds: Types.ObjectId[]) =>
   enrollmentModel
      .find({
         programId,
         currentStage: ENROLLMENT_STAGE.ATTENDED,
         _id: { $nin: invoicedIds },
      })
      .populate<{ employeeId: { name: string; employeeCode?: string } }>("employeeId", "name employeeCode");

const groupByCompany = <T extends { orgId?: Types.ObjectId }>(items: T[]) => {
   const groups = new Map<string, T[]>();
   for (const item of items) {
      const key = String(item.orgId);
      groups.set(key, [...(groups.get(key) ?? []), item]);
   }
   return groups;
};

export const getInvoiceCompaniesService = async (programId: string, providerId: string) => {
   const program = await loadProgramForProvider(programId, providerId);
   const invoicedIds = (await invoiceModel.find({ programId: program._id }).distinct("companies.lines.enrollmentId")) as Types.ObjectId[];
   const enrollments = await loadBillableEnrollments(program._id, invoicedIds);
   const groups = groupByCompany(enrollments);

   const orgs = await organizationModel.find({ _id: { $in: [...groups.keys()] } }).select("name");
   const nameById = new Map(orgs.map((org) => [String(org._id), org.name]));

   return [...groups.entries()].map(([orgId, items]) => ({
      companyOrgId: orgId,
      companyName: nameById.get(orgId) ?? "",
      billableCount: items.length,
   }));
};

export const generateProgramInvoiceService = async (
   programId: string,
   providerId: string,
   input: { companies: CompanyBillingInput[] }
) => {
   const program = await loadProgramForProvider(programId, providerId);
   if (!program.endDate || program.endDate > new Date()) {
      throw new AppError(MESSAGES.INVOICE_PROGRAM_NOT_ENDED, HTTP_STATUS.BAD_REQUEST);
   }

   const invoicedIds = (await invoiceModel.find({ programId: program._id }).distinct("companies.lines.enrollmentId")) as Types.ObjectId[];
   const enrollments = await loadBillableEnrollments(program._id, invoicedIds);
   if (enrollments.length === 0) {
      throw new AppError(MESSAGES.INVOICE_NO_BILLABLE_PARTICIPANTS, HTTP_STATUS.BAD_REQUEST);
   }

   const groups = groupByCompany(enrollments);
   const inputByOrg = new Map(input.companies.map((company) => [company.companyOrgId, company]));
   for (const orgId of groups.keys()) {
      if (!inputByOrg.has(orgId)) {
         throw new AppError(MESSAGES.INVOICE_COMPANY_DETAILS_MISSING, HTTP_STATUS.BAD_REQUEST);
      }
   }

   const enrollmentIds = enrollments.map((enrollment) => enrollment._id);
   const attendance = await attendanceRecordModel.find({ enrollmentId: { $in: enrollmentIds } });
   const attendanceByEnrollment = new Map(attendance.map((record) => [String(record.enrollmentId), record]));

   const orgs = await organizationModel.find({ _id: { $in: [...groups.keys()] } }).select("name");
   const nameById = new Map(orgs.map((org) => [String(org._id), org.name]));

   const companies: IInvoiceCompany[] = [...groups.entries()].map(([orgId, items]) => {
      const details = inputByOrg.get(orgId)!;

      const lines: IInvoiceLine[] = items.map((enrollment) => {
         const stayType = enrollment.travelAndStay?.stayType;
         const stayOption = program.stayOptions.find((option) => option.type === stayType);
         if (!stayOption) {
            throw new AppError(MESSAGES.INVOICE_STAY_PRICE_MISSING, HTTP_STATUS.BAD_REQUEST);
         }
         const employee = enrollment.employeeId as unknown as { name: string; employeeCode?: string };
         const days = attendanceByEnrollment.get(String(enrollment._id))?.attendanceByDay;
         const attendance = days
            ? [...days.entries()]
               .sort(([a], [b]) => a.localeCompare(b))
               .map(([day, entry]) => ({ day, status: entry.status }))
            : [];
         const dayStatuses = attendance.map((entry) => entry.status);
         return {
            enrollmentId: enrollment._id,
            participantName: employee.name,
            employeeCode: employee.employeeCode,
            stayType: stayType!,
            feePaise: Math.round(stayOption.price * 100),
            daysPresent: dayStatuses.filter((status) => status === ATTENDANCE_DAY_STATUS.PRESENT).length,
            totalDays: dayStatuses.length,
            attendance,
         };
      });

      const subtotalPaise = lines.reduce((sum, line) => sum + line.feePaise, 0);
      const tax = computeInvoiceTax({
         subtotalPaise,
         discountPercent: details.discountPercent,
         providerStateCode: PROVIDER_BILLING.stateCode,
         buyerStateCode: details.stateCode,
      });

      return {
         companyOrgId: items[0].orgId,
         companyName: nameById.get(orgId) ?? "",
         gstin: details.gstin,
         stateCode: details.stateCode,
         stateName: details.stateName,
         discountPercent: details.discountPercent,
         lines,
         subtotalPaise: tax.subtotalPaise,
         discountPaise: tax.discountPaise,
         taxablePaise: tax.taxablePaise,
         cgstPaise: tax.cgstPaise,
         sgstPaise: tax.sgstPaise,
         igstPaise: tax.igstPaise,
         totalPaise: tax.totalPaise,
      } as IInvoiceCompany;
   });

   const sum = (pick: (company: IInvoiceCompany) => number) =>
      companies.reduce((total, company) => total + pick(company), 0);

   const provider = await userModel.findById(providerId).select("name");

   const invoiceSeq = await invoiceCounterModel.findOneAndUpdate(
      { _id: "invoice" },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" }
   );

   return await invoiceModel.create({
      invoiceNumber: `INV-${String(invoiceSeq!.seq).padStart(4, "0")}`,
      programId: program._id,
      providerId,
      invoiceDate: new Date(),
      provider: {
         name: provider?.name ?? "",
         gstin: PROVIDER_BILLING.gstin,
         pan: PROVIDER_BILLING.pan,
         stateCode: PROVIDER_BILLING.stateCode,
         stateName: PROVIDER_BILLING.stateName,
      },
      companies,
      subtotalPaise: sum((c) => c.subtotalPaise),
      discountPaise: sum((c) => c.discountPaise),
      taxablePaise: sum((c) => c.taxablePaise),
      cgstPaise: sum((c) => c.cgstPaise),
      sgstPaise: sum((c) => c.sgstPaise),
      igstPaise: sum((c) => c.igstPaise),
      totalPaise: sum((c) => c.totalPaise),
   });
};

export const listProgramInvoicesService = async (programId: string, providerId: string) => {
   const program = await loadProgramForProvider(programId, providerId);
   return await invoiceModel.find({ programId: program._id }).sort({ createdAt: -1 });
};

export const getInvoiceForProviderService = async (invoiceId: string, providerId: string) => {
   const invoice = await invoiceModel.findOne({ _id: invoiceId, providerId });
   if (!invoice) throw new AppError(MESSAGES.INVOICE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   return invoice;
};
