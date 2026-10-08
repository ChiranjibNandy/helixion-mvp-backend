import { NextFunction, Request, Response } from "express";
import {
   generateProgramInvoiceService,
   getInvoiceCompaniesService,
   getInvoiceForProviderService,
   listProgramInvoicesService,
} from "../services/invoice.service.js";
import { renderInvoicePdf } from "../utils/invoicePdf.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";

export const getInvoiceCompanies = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const companies = await getInvoiceCompaniesService(req.params.id as string, req.userId as string);
      return res.status(HTTP_STATUS.OK).json({ success: true, data: companies });
   } catch (error) {
      next(error);
   }
};

export const generateProgramInvoice = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const invoice = await generateProgramInvoiceService(
         req.params.id as string,
         req.userId as string,
         req.body
      );
      return res.status(HTTP_STATUS.CREATED).json({
         success: true,
         message: MESSAGES.INVOICE_GENERATED,
         data: invoice,
      });
   } catch (error) {
      next(error);
   }
};

export const listProgramInvoices = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const invoices = await listProgramInvoicesService(req.params.id as string, req.userId as string);
      return res.status(HTTP_STATUS.OK).json({ success: true, data: invoices });
   } catch (error) {
      next(error);
   }
};

export const downloadInvoicePdf = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const invoice = await getInvoiceForProviderService(req.params.invoiceId as string, req.userId as string);
      const pdf = await renderInvoicePdf(invoice);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoiceNumber}.pdf"`);
      return res.status(HTTP_STATUS.OK).send(pdf);
   } catch (error) {
      next(error);
   }
};
