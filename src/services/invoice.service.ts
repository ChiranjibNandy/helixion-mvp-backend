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
import { getProviderBillingDetails } from "../utils/providerBilling.js";
import { getStateCodeFromGstin, formatBillingAddress } from "../utils/billingProfile.js";
import { findSettingsProfilesByOwnerIdsRepo } from "../repositories/settings.repository.js";
import { computeInvoiceTax } from "../utils/invoiceTax.js";

export interface CompanyBillingOverride {
   gstin?: string;
   stateCode?: string;
   stateName?: string;
   discountPercent: number;
}

const BILLABLE_STAGES = [ENROLLMENT_STAGE.ATTENDED, ENROLLMENT_STAGE.ABSENT];

const loadProgramForProvider = async (programId: string, providerId: string) => {
   const program = await getProgramByIdRepo(programId, providerId);
   if (!program) throw new AppError(MESSAGES.PROGRAM_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   return program;
};

const loadBillableEnrollments = async (programId: Types.ObjectId, invoicedIds: Types.ObjectId[], onlyOrgId?: string) =>
   enrollmentModel
      .find({
         programId,
         currentStage: { $in: BILLABLE_STAGES },
         _id: { $nin: invoicedIds },
         ...(onlyOrgId ? { orgId: new Types.ObjectId(onlyOrgId) } : {}),
      })
      .populate<{ employeeId: { name: string; employeeCode?: string; designation?: string } }>(
         "employeeId",
         "name employeeCode designation"
      );

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

   const orgIds = [...groups.keys()];
   const [orgs, settingsProfiles] = await Promise.all([
      organizationModel.find({ _id: { $in: orgIds } }).select("name"),
      findSettingsProfilesByOwnerIdsRepo(orgIds),
   ]);
   const byId = new Map(orgs.map((org) => [String(org._id), org]));
   const settingsByOrgId = new Map(settingsProfiles.map((profile) => [String(profile.ownerId), profile]));

   return [...groups.entries()].map(([orgId, items]) => {
      const org = byId.get(orgId);
      const settings = settingsByOrgId.get(orgId);
      return {
         companyOrgId: orgId,
         companyName: org?.name ?? "",
         billableCount: items.length,
         hasBillingDetails: !!settings?.gstNumber,
      };
   });
};

const computeCompanies = async (
   programId: string,
   providerId: string,
   overridesByOrg: Map<string, CompanyBillingOverride>,
   onlyOrgId?: string
) => {
   const program = await loadProgramForProvider(programId, providerId);
   if (!program.endDate || program.endDate > new Date()) {
      throw new AppError(MESSAGES.INVOICE_PROGRAM_NOT_ENDED, HTTP_STATUS.BAD_REQUEST);
   }

   const invoicedIds = (await invoiceModel.find({ programId: program._id }).distinct("companies.lines.enrollmentId")) as Types.ObjectId[];
   const enrollments = await loadBillableEnrollments(program._id, invoicedIds, onlyOrgId);
   if (enrollments.length === 0) {
      throw new AppError(MESSAGES.INVOICE_NO_BILLABLE_PARTICIPANTS, HTTP_STATUS.BAD_REQUEST);
   }

   const groups = groupByCompany(enrollments);
   const orgIds = [...groups.keys()];
   const [orgs, settingsProfiles, providerUser] = await Promise.all([
      organizationModel.find({ _id: { $in: orgIds } }).select("name"),
      findSettingsProfilesByOwnerIdsRepo(orgIds),
      userModel.findById(providerId).select("name email"),
   ]);
   const orgById = new Map(orgs.map((org) => [String(org._id), org]));
   const settingsByOrgId = new Map(settingsProfiles.map((profile) => [String(profile.ownerId), profile]));
   const providerBilling = await getProviderBillingDetails(providerId, providerUser?.email);

   const enrollmentIds = enrollments.map((enrollment) => enrollment._id);
   const attendance = await attendanceRecordModel.find({ enrollmentId: { $in: enrollmentIds } });
   const attendanceByEnrollment = new Map(attendance.map((record) => [String(record.enrollmentId), record]));

   const companies: IInvoiceCompany[] = [...groups.entries()].map(([orgId, items]) => {
      const org = orgById.get(orgId);
      const settings = settingsByOrgId.get(orgId);
      const override = overridesByOrg.get(orgId);

      const lines: IInvoiceLine[] = items.map((enrollment) => {
         const stayType = enrollment.travelAndStay?.stayType;
         const stayOption = program.stayOptions.find((option) => option.type === stayType);
         if (!stayOption) {
            throw new AppError(MESSAGES.INVOICE_STAY_PRICE_MISSING, HTTP_STATUS.BAD_REQUEST);
         }
         const employee = enrollment.employeeId as unknown as { name: string; employeeCode?: string; designation?: string };
         const days = attendanceByEnrollment.get(String(enrollment._id))?.attendanceByDay;
         const attendanceEntries = days
            ? [...days.entries()]
               .sort(([a], [b]) => a.localeCompare(b))
               .map(([day, entry]) => ({ day, status: entry.status }))
            : [];
         return {
            enrollmentId: enrollment._id,
            participantName: employee.name,
            employeeCode: employee.employeeCode,
            designation: employee.designation,
            stayType: stayType!,
            feePaise: Math.round(stayOption.price * 100),
            daysPresent: attendanceEntries.filter((entry) => entry.status === ATTENDANCE_DAY_STATUS.PRESENT).length,
            totalDays: attendanceEntries.length,
            attendance: attendanceEntries,
         };
      });

      const subtotalPaise = lines.reduce((sum, line) => sum + line.feePaise, 0);
      const gstin = override?.gstin ?? String(settings?.gstNumber ?? "");
      const stateCode = override?.stateCode ?? getStateCodeFromGstin(gstin);
      const stateName = override?.stateName ?? settings?.location?.state ?? "";
      const discountPercent = override?.discountPercent ?? 0;

      const tax = computeInvoiceTax({
         subtotalPaise,
         discountPercent,
         providerStateCode: providerBilling.stateCode,
         buyerStateCode: stateCode,
      });

      return {
         companyOrgId: items[0].orgId,
         companyName: org?.name ?? "",
         gstin,
         stateCode,
         stateName,
         address: formatBillingAddress(settings?.location),
         discountPercent,
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

   return {
      programId: program._id,
      providerId,
      program: {
         title: program.title,
         venue: program.venueName,
         city: program.city,
         startDate: program.startDate,
         endDate: program.endDate,
      },
      hsnSac: "998311",
      provider: {
         name: providerUser?.name ?? "",
         gstin: providerBilling.gstin,
         pan: providerBilling.pan,
         stateCode: providerBilling.stateCode,
         stateName: providerBilling.stateName,
         address: providerBilling.address,
         email: providerBilling.email,
         phone: providerBilling.phone,
      },
      companies,
   };
};

const sumCompanies = (companies: IInvoiceCompany[], pick: (company: IInvoiceCompany) => number) =>
   companies.reduce((total, company) => total + pick(company), 0);

export const getInvoicePreviewDataService = async (programId: string, providerId: string) => {
   let base;
   try {
      base = await computeCompanies(programId, providerId, new Map());
   } catch (error) {
      if (error instanceof AppError && error.statusCode === HTTP_STATUS.BAD_REQUEST) {
         return [];
      }
      throw error;
   }

   return base.companies.map((company) => ({
      invoiceNumber: "PREVIEW",
      invoiceDate: new Date(),
      program: base.program,
      provider: base.provider,
      hsnSac: base.hsnSac,
      companies: [company],
      subtotalPaise: company.subtotalPaise,
      discountPaise: company.discountPaise,
      taxablePaise: company.taxablePaise,
      cgstPaise: company.cgstPaise,
      sgstPaise: company.sgstPaise,
      igstPaise: company.igstPaise,
      totalPaise: company.totalPaise,
   }));
};

export const generateProgramInvoiceService = async (
   programId: string,
   providerId: string,
   companyOrgId: string,
   override: CompanyBillingOverride
) => {
   const overridesByOrg = new Map([[companyOrgId, override]]);
   const base = await computeCompanies(programId, providerId, overridesByOrg, companyOrgId);
   const company = base.companies[0];

   const invoiceSeq = await invoiceCounterModel.findOneAndUpdate(
      { _id: "invoice" },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" }
   );

   return await invoiceModel.create({
      invoiceNumber: `INV-${String(invoiceSeq!.seq).padStart(4, "0")}`,
      programId: base.programId,
      providerId: base.providerId,
      invoiceDate: new Date(),
      program: base.program,
      hsnSac: base.hsnSac,
      provider: base.provider,
      companies: [company],
      subtotalPaise: sumCompanies([company], (c) => c.subtotalPaise),
      discountPaise: sumCompanies([company], (c) => c.discountPaise),
      taxablePaise: sumCompanies([company], (c) => c.taxablePaise),
      cgstPaise: sumCompanies([company], (c) => c.cgstPaise),
      sgstPaise: sumCompanies([company], (c) => c.sgstPaise),
      igstPaise: sumCompanies([company], (c) => c.igstPaise),
      totalPaise: sumCompanies([company], (c) => c.totalPaise),
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
