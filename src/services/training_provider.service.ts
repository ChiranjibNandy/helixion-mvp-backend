import { BulkInput, createProgramReq } from "../dtos/program.dto.js";
import { createProgramRepo, programBulkInsert, updateProgramRepo } from "../repositories/program.repository.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";
import fs from "fs";
import csv from "csv-parser";
import { bulkProgramRowSchema } from "../validators/training_provider.validator.js";
import { AppError } from "../utils/appError.js";
import { MESSAGES } from "../constants/messages.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";



export const createOrUpdateProgramService = async (data: createProgramReq) => {
  let brochureUrl: string | undefined;
  if (data.file) {
    brochureUrl = await uploadToCloudinary(data.file);
  }
  const payload = {
    ...data,
    brochureUrl,
  };

  // remove file before DB operation
  delete (payload as any).file;

  if (data._id) {
    return await updateProgramRepo(data._id.toString(), payload);
  }
  return await createProgramRepo({ ...data, brochureUrl });
};

//bulk program upload service

export const bulkCreateProgramService = async ({
  file,
  training_providerId,
}: BulkInput) => {
  const results: any[] = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(file.path)
      .pipe(csv())
      .on("data", (row) => {
        results.push(row);
      })
      .on("end", resolve)
      .on("error", reject);
  });

  const validPrograms: any[] = [];
  const errors: any[] = [];

  results.forEach((row, index) => {
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
        training_providerId,
      });
    }
  });

  if (validPrograms.length === 0) {
    throw new AppError(MESSAGES.NO_PROGRAM_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  const inserted = await programBulkInsert(validPrograms);

  return {
    insertedCount: inserted.length,
    failedCount: errors.length,
    errors,
  };
};