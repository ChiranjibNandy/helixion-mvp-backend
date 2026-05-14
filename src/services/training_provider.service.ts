import { BulkInput, createProgramReq } from "../dtos/program.dto.js";
import { createProgramRepo, getLastBatchId, programBulkInsert, getDraftProgramsRepo, getProgramByIdRepo, updateProgramRepo, deleteProgramRepo } from "../repositories/program.repository.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";
import csv from "csv-parser";
import { bulkProgramRowSchema } from "../validators/training_provider.validator.js";
import { AppError } from "../utils/appError.js";
import { MESSAGES } from "../constants/messages.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import streamifier from "streamifier";



export const createProgramService = async (data: createProgramReq) => {
  let brochureUrl: string | undefined;
  let brochurePublicId: string | undefined;

  if (data.file) {
    const uploadResult = await uploadToCloudinary(data.file);

    brochureUrl = uploadResult.secure_url;
    brochurePublicId = uploadResult.public_id;
  }

  const payload = {
    ...data,
    brochureUrl,
    brochurePublicId,
  };

  delete (payload as any).file;

  return await createProgramRepo(payload);
};

//bulk program upload service

export const bulkCreateProgramService = async ({
  file,
  training_providerId,
}: BulkInput) => {
  const results: any[] = [];

  await new Promise((resolve, reject) => {
    streamifier.createReadStream(file.buffer)
      .pipe(csv())
      .on("data", (row) => {
        results.push(row);
      })
      .on("end", resolve)
      .on("error", reject);
  });

  const validPrograms: any[] = [];
  const errors: any[] = [];

  // get last batch
  const lastBatch = await getLastBatchId();

  // extract last batch number
  const lastBatchNumber =
    Number(lastBatch?.batchId?.split("_")[1]) || 0;

  // generate ONE batchId for this upload
  const newBatchId = `batch_${ lastBatchNumber + 1 }`;


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
        batchId: newBatchId
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

// get draft programs service
export const getDraftProgramsService = async (
  providerId: string,
  page: number,
  limit: number,
  search?: string
) => {
  const skip = (page - 1) * limit;
  const { programs, total } = await getDraftProgramsRepo(providerId, skip, limit, search);
  
  return {
    programs,
    total,
    page,
    totalPages: Math.ceil(total / limit)
  };
};

// get single draft service
export const getDraftByIdService = async (id: string, providerId: string) => {
  const program = await getProgramByIdRepo(id, providerId);
  if (!program) {
    throw new AppError(MESSAGES.PROGRAM_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }
  return program;
};

// update draft service
export const updateDraftService = async (
  id: string,
  providerId: string,
  data: any,
  file?: Express.Multer.File
) => {
  const program = await getProgramByIdRepo(id, providerId);
  if (!program) {
    throw new AppError(MESSAGES.PROGRAM_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  let brochureUrl: string | undefined = program.brochureUrl;
  let brochurePublicId: string | undefined = program.brochurePublicId;

  if (file) {
    const uploadResult = await uploadToCloudinary(file);
    brochureUrl = uploadResult.secure_url;
    brochurePublicId = uploadResult.public_id;
  }

  const updateData = {
    ...data,
    ...(file && { brochureUrl, brochurePublicId })
  };

  const updatedProgram = await updateProgramRepo(id, providerId, updateData);
  return updatedProgram;
};

// publish draft service
import { createProgramSchema } from "../validators/training_provider.validator.js";
import { PROGRAM_SAVED_STATUS } from "../constants/enum.js";

export const publishDraftService = async (id: string, providerId: string) => {
  const program = await getProgramByIdRepo(id, providerId);
  if (!program) {
    throw new AppError(MESSAGES.PROGRAM_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  // Use the createProgramSchema to validate if all required fields for publishing are present
  const validationData = {
    ...program.toObject(),
    status: PROGRAM_SAVED_STATUS.PUBLISHED
  };

  const parsed = createProgramSchema.safeParse(validationData);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0].message, HTTP_STATUS.BAD_REQUEST);
  }

  const updatedProgram = await updateProgramRepo(id, providerId, { status: PROGRAM_SAVED_STATUS.PUBLISHED });
  return updatedProgram;
};

// delete draft service
export const deleteDraftService = async (id: string, providerId: string) => {
  const program = await deleteProgramRepo(id, providerId);
  if (!program) {
    throw new AppError(MESSAGES.PROGRAM_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }
  return program;
};