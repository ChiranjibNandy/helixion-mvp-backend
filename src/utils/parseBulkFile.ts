import csv from "csv-parser";
import streamifier from "streamifier";
import XLSX from "xlsx";

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
            .on("error", reject);
      });
   }

   // XLS / XLSX
   if (extension === ".xls" || extension === ".xlsx") {
      try {
         const workbook = XLSX.read(buffer, {
            type: "buffer",
            raw: false,
         });

         if (!workbook.SheetNames.length) {
            return Promise.reject(
               new Error("The uploaded Excel file does not contain any sheets.")
            );
         }

         // Use the first sheet
         const sheetName = workbook.SheetNames[0];

         if (!sheetName) {
            return Promise.reject(
               new Error("Unable to read the Excel sheet.")
            );
         }

         const worksheet = workbook.Sheets[sheetName];

         if (!worksheet) {
            return Promise.reject(
               new Error("Unable to read the Excel worksheet.")
            );
         }

         const results = XLSX.utils.sheet_to_json<Record<string, any>>(
            worksheet,
            {
               defval: "",
               raw: false,
            }
         );

         return Promise.resolve(results);
      } catch (error) {
         return Promise.reject(error);
      }
   }

   return Promise.reject(
      new Error("Unsupported file format. Only CSV, XLS and XLSX are allowed.")
   );
};