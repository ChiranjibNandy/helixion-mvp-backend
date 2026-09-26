import csv from "csv-parser";
import streamifier from "streamifier";
import XLSX from "xlsx";
import { AppError } from "../utils/appError.js";

/**
 * Formats Excel Date values as yyyy-mm-dd.
 */
const formatExcelDate = (value: unknown): unknown => {
   if (value instanceof Date && !Number.isNaN(value.getTime())) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, "0");
      const day = String(value.getDate()).padStart(2, "0");

      return `${ year }-${ month }-${ day }`;
   }

   return value;
};

/**
 * Parses CSV, XLS, or XLSX file buffer into an array of row objects.
 */
export const parseBulkFileBuffer = (
   buffer: Buffer,
   fileName: string
): Promise<Record<string, any>[]> => {
   const extension = fileName
      .toLowerCase()
      .substring(fileName.lastIndexOf("."));

   // CSV
   if (extension === ".csv") {
      return new Promise((resolve, reject) => {
         const results: Record<string, any>[] = [];

         streamifier
            .createReadStream(buffer)
            .pipe(csv())
            .on("data", (row) => results.push(row))
            .on("end", () => resolve(results))
            .on("error", () => {
               reject(
                  new AppError(
                     "Unable to parse the uploaded CSV file.",
                     400
                  )
               );
            });
      });
   }

   // XLS / XLSX
   if (extension === ".xls" || extension === ".xlsx") {
      try {
         const workbook = XLSX.read(buffer, {
            type: "buffer",
            cellDates: true,
         });

         if (!workbook.SheetNames.length) {
            throw new AppError(
               "The uploaded Excel file does not contain any sheets.",
               400
            );
         }

         // Use the first sheet
         const sheetName = workbook.SheetNames[0];

         if (!sheetName) {
            throw new AppError(
               "Unable to read the Excel sheet.",
               400
            );
         }

         const worksheet = workbook.Sheets[sheetName];

         if (!worksheet) {
            throw new AppError(
               "Unable to read the Excel worksheet.",
               400
            );
         }

         const rows = XLSX.utils.sheet_to_json<Record<string, any>>(
            worksheet,
            {
               defval: "",
               raw: true,
            }
         );

         // Explicitly format Excel date cells as yyyy-mm-dd
         const results = rows.map((row) => {
            const formattedRow: Record<string, any> = {};

            Object.entries(row).forEach(([key, value]) => {
               formattedRow[key] = formatExcelDate(value);
            });

            return formattedRow;
         });

         return Promise.resolve(results);
      } catch (error) {
         // Preserve existing AppError responses
         if (error instanceof AppError) {
            return Promise.reject(error);
         }

         // Convert Excel parsing errors/corrupt files to 400
         return Promise.reject(
            new AppError(
               "Unable to parse the uploaded Excel file. Please upload a valid XLS or XLSX file.",
               400
            )
         );
      }
   }

   // Unsupported format
   return Promise.reject(
      new AppError(
         "Unsupported file format. Only CSV, XLS and XLSX are allowed.",
         400
      )
   );
};