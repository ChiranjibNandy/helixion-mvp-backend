import PDFDocument from "pdfkit";
import { GST_RATE_PERCENT } from "./invoiceTax.js";

interface PdfLine {
   participantName: string;
   employeeCode?: string;
   stayType: string;
   feePaise: number;
   daysPresent: number;
   totalDays: number;
   attendance: { day: string; status: string }[];
}

interface PdfCompany {
   companyName: string;
   gstin: string;
   stateCode: string;
   stateName: string;
   discountPercent: number;
   lines: PdfLine[];
   subtotalPaise: number;
   discountPaise: number;
   taxablePaise: number;
   cgstPaise: number;
   sgstPaise: number;
   igstPaise: number;
   totalPaise: number;
}

export interface InvoicePdfData {
   invoiceNumber: string;
   invoiceDate: Date;
   provider: { name: string; gstin: string; pan: string; stateCode: string; stateName: string };
   companies: PdfCompany[];
   totalPaise: number;
}

const LEFT = 40;
const RIGHT = 555;
const WIDTH = RIGHT - LEFT;
const BOTTOM = 770;
const HEADER_FILL = "#e8edf5";
const BAND_FILL = "#1e293b";
const GRID = "#9aa5b5";
const ROW_HEIGHT = 17;
const TEXT_PAD = 4;

const money = (paise: number) =>
   (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dateText = (date: Date) =>
   date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const shortDate = (day: string) =>
   new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });

interface Column {
   header: string;
   width: number;
   align?: "left" | "right" | "center";
   value: (row: any, index: number) => string;
}

export const renderInvoicePdf = (invoice: InvoicePdfData): Promise<Buffer> =>
   new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      let y = 40;

      const ensureSpace = (needed: number, onNewPage?: () => void) => {
         if (y + needed > BOTTOM) {
            doc.addPage();
            y = 40;
            onNewPage?.();
         }
      };

      const cell = (text: string, x: number, width: number, align: "left" | "right" | "center" = "left") =>
         doc.text(text, x + TEXT_PAD, y + 4, { width: width - TEXT_PAD * 2, align, lineBreak: false, ellipsis: true });

      const drawTableHeader = (columns: Column[]) => {
         doc.save();
         doc.rect(LEFT, y, WIDTH, ROW_HEIGHT).fill(HEADER_FILL);
         doc.restore();
         doc.fillColor("#000").font("Helvetica-Bold").fontSize(8);
         let x = LEFT;
         columns.forEach((col) => {
            cell(col.header, x, col.width, col.align);
            x += col.width;
         });
         doc.rect(LEFT, y, WIDTH, ROW_HEIGHT).strokeColor(GRID).stroke();
         y += ROW_HEIGHT;
      };

      const drawTable = (columns: Column[], rows: any[], totalsRow?: { label: string; value: string }) => {
         const drawHeader = () => drawTableHeader(columns);
         ensureSpace(ROW_HEIGHT * 2);
         drawHeader();
         doc.font("Helvetica").fontSize(8).fillColor("#000");
         rows.forEach((row, index) => {
            ensureSpace(ROW_HEIGHT, drawHeader);
            let x = LEFT;
            columns.forEach((col) => {
               doc.rect(x, y, col.width, ROW_HEIGHT).strokeColor(GRID).stroke();
               cell(col.value(row, index), x, col.width, col.align);
               x += col.width;
            });
            y += ROW_HEIGHT;
         });
         if (totalsRow) {
            ensureSpace(ROW_HEIGHT);
            doc.rect(LEFT, y, WIDTH, ROW_HEIGHT).fill(HEADER_FILL);
            doc.fillColor("#000").font("Helvetica-Bold").fontSize(8);
            doc.rect(LEFT, y, WIDTH, ROW_HEIGHT).strokeColor(GRID).stroke();
            doc.text(totalsRow.label, LEFT + TEXT_PAD, y + 4, { width: WIDTH - 120 - TEXT_PAD * 2, align: "right" });
            doc.text(totalsRow.value, RIGHT - 120, y + 4, { width: 120 - TEXT_PAD, align: "right" });
            y += ROW_HEIGHT;
         }
         y += 10;
      };

      const sectionTitle = (text: string) => {
         ensureSpace(24);
         doc.font("Helvetica-Bold").fontSize(9).fillColor("#000").text(text.toUpperCase(), LEFT, y, { lineBreak: false });
         y += 14;
      };

      // Header box
      doc.rect(LEFT, y, WIDTH, 92).strokeColor(GRID).stroke();
      doc.font("Helvetica-Bold").fontSize(16).fillColor("#000").text("TAX INVOICE", LEFT, y + 10, { width: WIDTH, align: "center" });
      doc.font("Helvetica-Bold").fontSize(11).text(invoice.provider.name, LEFT + 10, y + 34);
      doc.font("Helvetica").fontSize(9)
         .text(`GSTIN: ${invoice.provider.gstin}`, LEFT + 10, y + 52)
         .text(`PAN: ${invoice.provider.pan}`, LEFT + 10, y + 64)
         .text(`State: ${invoice.provider.stateName} (Code ${invoice.provider.stateCode})`, LEFT + 10, y + 76);
      doc.font("Helvetica").fontSize(9)
         .text(`Invoice No: ${invoice.invoiceNumber}`, RIGHT - 210, y + 34, { width: 200, align: "right" })
         .text(`Date: ${dateText(invoice.invoiceDate)}`, RIGHT - 210, y + 50, { width: 200, align: "right" });
      y += 92 + 16;

      invoice.companies.forEach((company) => {
         const intraState = company.stateCode === invoice.provider.stateCode;
         const taxLabels = intraState ? ["CGST", "SGST"] : ["IGST", ""];

         ensureSpace(60);
         doc.rect(LEFT, y, WIDTH, 22).fill(BAND_FILL);
         doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(10)
            .text(company.companyName, LEFT + 8, y + 6, { width: WIDTH * 0.6, lineBreak: false, ellipsis: true });
         doc.font("Helvetica").fontSize(8)
            .text(`GSTIN ${company.gstin}  |  ${company.stateName} (Code ${company.stateCode})`, LEFT + WIDTH * 0.4, y + 7, {
               width: WIDTH * 0.6 - 8,
               align: "right",
               lineBreak: false,
            });
         doc.fillColor("#000");
         y += 30;

         const feeColumns: Column[] = [
            { header: "Sr.", width: 22, value: (_l, i) => String(i + 1) },
            { header: "Participant", width: 110, value: (l: PdfLine) => l.participantName },
            { header: "Emp. code", width: 52, value: (l: PdfLine) => l.employeeCode ?? "-" },
            { header: "Stay", width: 68, value: (l: PdfLine) => l.stayType.replace(/_/g, " ") },
            { header: "Days", width: 36, align: "center", value: (l: PdfLine) => `${l.daysPresent}/${l.totalDays}` },
            { header: "Fee (Rs.)", width: 62, align: "right", value: (l: PdfLine) => money(l.feePaise) },
            {
               header: taxLabels[0],
               width: 50,
               align: "right",
               value: (l: PdfLine) => {
                  const tax = Math.round((l.feePaise * GST_RATE_PERCENT) / 100);
                  return money(intraState ? Math.round(tax / 2) : tax);
               },
            },
            {
               header: taxLabels[1] || "-",
               width: 50,
               align: "right",
               value: (l: PdfLine) => {
                  if (!intraState) return "-";
                  const tax = Math.round((l.feePaise * GST_RATE_PERCENT) / 100);
                  return money(tax - Math.round(tax / 2));
               },
            },
            {
               header: "Line total",
               width: 0,
               align: "right",
               value: (l: PdfLine) => money(l.feePaise + Math.round((l.feePaise * GST_RATE_PERCENT) / 100)),
            },
         ];
         const used = feeColumns.reduce((sum, col) => sum + col.width, 0);
         feeColumns[feeColumns.length - 1].width = WIDTH - used;

         drawTable(feeColumns, company.lines);

         const summaryRows: [string, number][] = [["Subtotal", company.subtotalPaise]];
         if (company.discountPaise > 0) {
            summaryRows.push([`Discount (${company.discountPercent}%)`, -company.discountPaise]);
         }
         summaryRows.push(["Taxable value", company.taxablePaise]);
         if (company.igstPaise > 0) {
            summaryRows.push([`IGST @ ${GST_RATE_PERCENT}%`, company.igstPaise]);
         } else {
            summaryRows.push([`CGST @ ${GST_RATE_PERCENT / 2}%`, company.cgstPaise]);
            summaryRows.push([`SGST @ ${GST_RATE_PERCENT / 2}%`, company.sgstPaise]);
         }
         ensureSpace(summaryRows.length * ROW_HEIGHT + ROW_HEIGHT + 10);
         summaryRows.forEach(([label, paise]) => {
            doc.rect(RIGHT - 240, y, 240, ROW_HEIGHT).strokeColor(GRID).stroke();
            doc.font("Helvetica").fontSize(8).fillColor("#000");
            doc.text(label, RIGHT - 240 + TEXT_PAD, y + 4, { width: 150, lineBreak: false });
            doc.text(money(paise), RIGHT - 120, y + 4, { width: 116, align: "right", lineBreak: false });
            y += ROW_HEIGHT;
         });
         doc.rect(RIGHT - 240, y, 240, ROW_HEIGHT).fill(HEADER_FILL);
         doc.rect(RIGHT - 240, y, 240, ROW_HEIGHT).strokeColor(GRID).stroke();
         doc.font("Helvetica-Bold").fontSize(8).fillColor("#000");
         doc.text(`Total: ${company.companyName}`, RIGHT - 240 + TEXT_PAD, y + 4, { width: 150, lineBreak: false });
         doc.text(money(company.totalPaise), RIGHT - 120, y + 4, { width: 116, align: "right", lineBreak: false });
         y += ROW_HEIGHT + 14;

         const days = [...new Set(company.lines.flatMap((line) => line.attendance.map((entry) => entry.day)))].sort();
         if (days.length > 0) {
            sectionTitle("Attendance register");
            const fixed = 150 + 40 + 40;
            const dayWidth = Math.min(60, (WIDTH - fixed) / days.length);
            const registerColumns: Column[] = [
               { header: "Participant", width: 150, value: (l: PdfLine) => l.participantName },
               ...days.map((day) => ({
                  header: shortDate(day),
                  width: dayWidth,
                  align: "center" as const,
                  value: (l: PdfLine) => {
                     const status = l.attendance.find((entry) => entry.day === day)?.status;
                     return status === "present" ? "P" : status === "absent" ? "A" : "-";
                  },
               })),
               { header: "Present", width: 40, align: "center", value: (l: PdfLine) => String(l.attendance.filter((e) => e.status === "present").length) },
               { header: "Absent", width: 40, align: "center", value: (l: PdfLine) => String(l.attendance.filter((e) => e.status === "absent").length) },
            ];
            const registerUsed = registerColumns.reduce((sum, col) => sum + col.width, 0);
            registerColumns[0].width += WIDTH - registerUsed;
            drawTable(registerColumns, company.lines);
         }
      });

      ensureSpace(90);
      sectionTitle("Summary");
      const summaryColumns: Column[] = [
         { header: "Company", width: 260, value: (c: PdfCompany) => c.companyName },
         { header: "Taxable value (Rs.)", width: 120, align: "right", value: (c: PdfCompany) => money(c.taxablePaise) },
         { header: "Tax (Rs.)", width: 85, align: "right", value: (c: PdfCompany) => money(c.cgstPaise + c.sgstPaise + c.igstPaise) },
         { header: "Total (Rs.)", width: WIDTH - 465, align: "right", value: (c: PdfCompany) => money(c.totalPaise) },
      ];
      drawTable(summaryColumns, invoice.companies, { label: "Grand total (Rs.)", value: money(invoice.totalPaise) });

      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
         doc.switchToPage(i);
         doc.font("Helvetica").fontSize(8).fillColor("#555")
            .text(
               `This is a computer generated invoice.   Page ${i + 1} of ${pageCount}`,
               LEFT,
               790,
               { width: WIDTH, align: "center", lineBreak: false }
            );
      }

      doc.end();
   });
