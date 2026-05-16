import csv from "csv-parser";
import streamifier from "streamifier";

/**
 * Parses a CSV file buffer into an array of row objects.
 * Streams the buffer through csv-parser for memory-efficient processing.
 */
export const parseCsvBuffer = (buffer: Buffer): Promise<any[]> => {
  const results: any[] = [];

  return new Promise((resolve, reject) => {
    streamifier.createReadStream(buffer)
      .pipe(csv())
      .on("data", (row) => results.push(row))
      .on("end", () => resolve(results))
      .on("error", reject);
  });
};
