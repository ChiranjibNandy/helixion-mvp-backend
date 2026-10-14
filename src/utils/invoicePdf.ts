import PDFDocument from "pdfkit";
import { GST_RATE_PERCENT } from "./invoiceTax.js";
import { amountInWords } from "./numberToWords.js";

interface PdfLine {
   participantName: string;
   employeeCode?: string;
   designation?: string;
   stayType: string;
   feePaise: number;
   daysPresent: number;
   totalDays: number;
   attendance: { day: string; status: string }[];
}

interface PdfParty {
   gstin: string;
   pan?: string;
   stateCode: string;
   stateName: string;
   address?: string;
   email?: string;
   phone?: string;
}

interface PdfCompany extends PdfParty {
   companyName: string;
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
   provider: PdfParty & { name: string };
   program: { title: string; venue?: string; city?: string; startDate?: Date; endDate?: Date };
   companies: PdfCompany[];
   totalPaise: number;
}

const LEFT = 40;
const RIGHT = 555;
const WIDTH = RIGHT - LEFT;
const BOTTOM = 770;

const TEXT = "#111827";
const MUTED = "#6b7280";
const RULE = "#d1d5db";
const INFO_BAR_FILL = "#f1f3f8";

const money = (paise: number) =>
   (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dateText = (date?: Date) =>
   date ? date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-";

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);

export const renderInvoicePdf = (invoice: InvoicePdfData): Promise<Buffer> =>
   new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      let y = 40;
      const ensureSpace = (needed: number) => {
         if (y + needed > BOTTOM) {
            doc.addPage();
            y = 40;
         }
      };

      // Manual truncation: bounded by string length, so a mis-sized column
      // can never make pdfkit's own text-fitting loop forever.
      const fitText = (text: string, maxWidth: number) => {
         if (doc.widthOfString(text) <= maxWidth) return text;
         let truncated = text;
         while (truncated.length > 1 && doc.widthOfString(`${truncated}…`) > maxWidth) {
            truncated = truncated.slice(0, -1);
         }
         return `${truncated}…`;
      };

      const label = (text: string, x: number, width: number) => {
         doc.font("Helvetica-Bold").fontSize(7.5).fillColor(MUTED)
            .text(text.toUpperCase(), x, y, { width, characterSpacing: 0.5 });
      };

      const programRange = () => {
         const start = dateText(invoice.program.startDate);
         const end = dateText(invoice.program.endDate);
         return start !== "-" && end !== "-" ? `${start} – ${end}` : start !== "-" ? start : "-";
      };

      invoice.companies.forEach((company, index) => {
         if (index > 0) {
            doc.addPage();
            y = 40;
         }

         // ── Header ──────────────────────────────────────────────────
         doc.font("Helvetica-Bold").fontSize(11).fillColor(TEXT).text(invoice.provider.name, LEFT, y);
         doc.font("Helvetica-Bold").fontSize(22).fillColor(TEXT).text("TAX INVOICE", LEFT, y + 16);

         const dueDate = addDays(invoice.invoiceDate, 30);
         doc.font("Helvetica").fontSize(9).fillColor(MUTED)
            .text(`Invoice No: `, 330, y, { continued: true }).font("Helvetica-Bold").fillColor(TEXT).text(invoice.invoiceNumber, { align: "right", width: RIGHT - 330 - doc.widthOfString("Invoice No: ") });
         doc.font("Helvetica").fontSize(9).fillColor(MUTED)
            .text(`Invoice Date: `, 330, y + 16, { continued: true }).font("Helvetica-Bold").fillColor(TEXT).text(dateText(invoice.invoiceDate), { align: "right", width: RIGHT - 330 - doc.widthOfString("Invoice Date: ") });
         doc.font("Helvetica").fontSize(9).fillColor(MUTED)
            .text(`Due Date: `, 330, y + 32, { continued: true }).font("Helvetica-Bold").fillColor(TEXT).text(dateText(dueDate), { align: "right", width: RIGHT - 330 - doc.widthOfString("Due Date: ") });

         y += 56;
         doc.moveTo(LEFT, y).lineTo(RIGHT, y).strokeColor(TEXT).lineWidth(1.2).stroke();
         y += 18;

         // ── From / Bill To ──────────────────────────────────────────
         const colWidth = (WIDTH - 24) / 2;
         const renderParty = (heading: string, name: string, party: PdfParty, x: number) => {
            let py = y;
            label(heading, x, colWidth);
            py += 12;
            doc.font("Helvetica-Bold").fontSize(10).fillColor(TEXT).text(name, x, py, { width: colWidth });
            py = doc.y + 2;
            if (party.address) {
               doc.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(party.address, x, py, { width: colWidth });
               py = doc.y + 2;
            }
            doc.font("Helvetica").fontSize(8.5).fillColor(MUTED)
               .text(`GSTIN: ${party.gstin || "-"}${party.pan ? `  ·  PAN: ${party.pan}` : ""}`, x, py, { width: colWidth });
            py = doc.y + 2;
            doc.text(`State: ${party.stateName || "-"} (${party.stateCode || "-"})`, x, py, { width: colWidth });
            py = doc.y + 2;
            if (party.email || party.phone) {
               doc.text([party.email, party.phone].filter(Boolean).join("  ·  "), x, py, { width: colWidth });
               py = doc.y + 2;
            }
            return py;
         };

         const leftBottom = renderParty("From (Training Provider)", invoice.provider.name, invoice.provider, LEFT);
         const rightBottom = renderParty("Bill To (Company)", company.companyName, company, LEFT + colWidth + 24);
         y = Math.max(leftBottom, rightBottom) + 10;

         // ── Program info bar ────────────────────────────────────────
         ensureSpace(50);
         const barHeight = 44;
         doc.roundedRect(LEFT, y, WIDTH, barHeight, 6).fill(INFO_BAR_FILL);
         const infoColWidth = WIDTH / 3;
         const infoY = y + 8;
         label("Training Program", LEFT + 12, infoColWidth - 16);
         label("Dates", LEFT + infoColWidth + 12, infoColWidth - 16);
         label("Venue", LEFT + infoColWidth * 2 + 12, infoColWidth - 16);
         doc.font("Helvetica-Bold").fontSize(9.5).fillColor(TEXT)
            .text(fitText(invoice.program.title, infoColWidth - 16), LEFT + 12, infoY + 12, { width: infoColWidth - 16 });
         doc.text(programRange(), LEFT + infoColWidth + 12, infoY + 12, { width: infoColWidth - 16 });
         doc.text(fitText([invoice.program.venue, invoice.program.city].filter(Boolean).join(", ") || "-", infoColWidth - 16), LEFT + infoColWidth * 2 + 12, infoY + 12, { width: infoColWidth - 16 });
         y += barHeight + 20;

         // ── Participant table ───────────────────────────────────────
         const cols = {
            sr: { x: LEFT, w: 24 },
            participant: { x: LEFT + 24, w: 160 },
            stay: { x: LEFT + 184, w: 90 },
            days: { x: LEFT + 274, w: 90 },
            rate: { x: LEFT + 364, w: 75 },
            amount: { x: LEFT + 439, w: RIGHT - (LEFT + 439) },
         };
         const drawTableHeader = () => {
            doc.font("Helvetica-Bold").fontSize(7.5).fillColor(MUTED);
            doc.text("#", cols.sr.x, y, { width: cols.sr.w });
            doc.text("PARTICIPANT", cols.participant.x, y, { width: cols.participant.w });
            doc.text("STAY TYPE", cols.stay.x, y, { width: cols.stay.w });
            doc.text("DAYS ATTENDED", cols.days.x, y, { width: cols.days.w, align: "center" });
            doc.text("RATE", cols.rate.x, y, { width: cols.rate.w, align: "right" });
            doc.text("AMOUNT", cols.amount.x, y, { width: cols.amount.w, align: "right" });
            y += 14;
            doc.moveTo(LEFT, y).lineTo(RIGHT, y).strokeColor(RULE).lineWidth(1).stroke();
            y += 8;
         };

         ensureSpace(40);
         drawTableHeader();

         company.lines.forEach((line) => {
            ensureSpace(28);
            const rowTop = y;
            doc.font("Helvetica").fontSize(9).fillColor(TEXT);
            doc.text(fitText(line.participantName, cols.participant.w), cols.participant.x, rowTop, { width: cols.participant.w });
            if (line.designation) {
               doc.font("Helvetica").fontSize(7.5).fillColor(MUTED)
                  .text(fitText(line.designation, cols.participant.w), cols.participant.x, rowTop + 12, { width: cols.participant.w });
            }
            doc.font("Helvetica").fontSize(9).fillColor(TEXT);
            doc.text(fitText(line.stayType.replace(/_/g, " "), cols.stay.w), cols.stay.x, rowTop, { width: cols.stay.w });
            doc.text(`${line.daysPresent} / ${line.totalDays}`, cols.days.x, rowTop, { width: cols.days.w, align: "center" });
            doc.text(`Rs. ${money(line.feePaise)}`, cols.rate.x, rowTop, { width: cols.rate.w, align: "right" });
            doc.text(`Rs. ${money(line.feePaise)}`, cols.amount.x, rowTop, { width: cols.amount.w, align: "right" });

            y = rowTop + (line.designation ? 24 : 18);
            doc.moveTo(LEFT, y).lineTo(RIGHT, y).strokeColor(RULE).lineWidth(0.5).stroke();
            y += 8;
         });

         // ── Totals ───────────────────────────────────────────────────
         ensureSpace(90);
         const totalsX = RIGHT - 220;
         const totalsRow = (text: string, value: string, bold = false) => {
            doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 10 : 9).fillColor(bold ? TEXT : MUTED);
            doc.text(text, totalsX, y, { width: 120 });
            doc.font(bold ? "Helvetica-Bold" : "Helvetica").fillColor(TEXT).text(value, totalsX + 120, y, { width: 100, align: "right" });
            y += bold ? 18 : 14;
         };

         totalsRow("Subtotal", `Rs. ${money(company.subtotalPaise)}`);
         if (company.discountPaise > 0) {
            totalsRow(`Discount (${company.discountPercent}%)`, `-Rs. ${money(company.discountPaise)}`);
         }
         totalsRow("Taxable value", `Rs. ${money(company.taxablePaise)}`);
         if (company.igstPaise > 0) {
            totalsRow(`IGST @ ${GST_RATE_PERCENT}%`, `Rs. ${money(company.igstPaise)}`);
         } else {
            totalsRow(`CGST @ ${GST_RATE_PERCENT / 2}%`, `Rs. ${money(company.cgstPaise)}`);
            totalsRow(`SGST @ ${GST_RATE_PERCENT / 2}%`, `Rs. ${money(company.sgstPaise)}`);
         }
         doc.moveTo(totalsX, y).lineTo(RIGHT, y).strokeColor(RULE).lineWidth(1).stroke();
         y += 6;
         totalsRow("Total payable", `Rs. ${money(company.totalPaise)}`, true);
         y += 10;

         // ── Amount in words ─────────────────────────────────────────
         ensureSpace(24);
         doc.font("Helvetica-Bold").fontSize(8.5).fillColor(MUTED).text("Amount Chargeable (in words): ", LEFT, y, { continued: true });
         doc.font("Helvetica").fillColor(TEXT).text(amountInWords(Math.round(company.totalPaise / 100)));
         y = doc.y + 14;

         // ── Note on fully-absent participants ───────────────────────
         const fullyAbsent = company.lines.filter((l) => l.totalDays > 0 && l.daysPresent === 0);
         if (fullyAbsent.length > 0) {
            ensureSpace(16 * fullyAbsent.length);
            doc.font("Helvetica").fontSize(7.5).fillColor(MUTED);
            fullyAbsent.forEach((l) => {
               doc.text(`Note: ${l.participantName} was absent for the entire programme. The fee is still payable as per enrolment confirmation.`, LEFT, y, { width: WIDTH });
               y = doc.y + 3;
            });
            y += 10;
         }

         // ── Terms + signatory ────────────────────────────────────────
         ensureSpace(60);
         doc.font("Helvetica").fontSize(7.5).fillColor(MUTED)
            .text("This is a computer generated invoice and does not require a physical signature.", LEFT, y, { width: WIDTH });
         y = doc.y + 24;
         doc.font("Helvetica").fontSize(9).fillColor(TEXT).text(`for ${invoice.provider.name}`, RIGHT - 200, y, { width: 200, align: "right" });
         doc.font("Helvetica-Bold").text("Authorised Signatory", RIGHT - 200, y + 20, { width: 200, align: "right" });
      });

      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
         doc.switchToPage(i);
         doc.font("Helvetica").fontSize(7.5).fillColor(MUTED)
            .text(`This is a computer generated invoice.   Page ${i + 1} of ${pageCount}`, LEFT, 792, {
               width: WIDTH,
               align: "center",
               lineBreak: false,
            });
      }

      doc.end();
   });
