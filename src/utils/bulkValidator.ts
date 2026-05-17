import { bulkProgramRowSchema } from "../validators/training_provider.validator.js";

interface BulkValidationError {
  row: number;
  errors: { path: string; message: string }[];
}

interface BulkValidationResult {
  validPrograms: any[];
  errors: BulkValidationError[];
}

/**
 * Validates an array of parsed CSV rows against the bulk program schema.
 * Separates valid programs from rows with validation errors.
 *
 * @param rows      – Raw CSV row objects
 * @param providerId – Training-provider ObjectId to stamp on each valid row
 * @param batchId   – Batch identifier for grouping this upload
 */
export const validateBulkRows = (
  rows: any[],
  providerId: string,
  batchId: string,
): BulkValidationResult => {
  const validPrograms: any[] = [];
  const errors: BulkValidationError[] = [];

  rows.forEach((row, index) => {
    const parsed = bulkProgramRowSchema.safeParse(row);

    if (!parsed.success) {
      errors.push({
        row: index + 1,
        errors: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    } else {
      validPrograms.push({
        ...parsed.data,
        training_providerId: providerId,
        batchId,
      });
    }
  });

  return { validPrograms, errors };
};
