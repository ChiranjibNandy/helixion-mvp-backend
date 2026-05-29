import { BulkInput, createProgramReq } from "../dtos/program.dto.js";
import { createProgramRepo, getLastBatchId, programBulkInsert, getDraftProgramsRepo, getProgramByIdRepo, updateProgramRepo, deleteProgramRepo, getLiveProgramsCount, getDraftProgramsCount, getTopPrograms, getAverageFillRate, getPublishedActivities, getDraftActivities, getBulkUploadActivities } from "../repositories/program.repository.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";
import { parseCsvBuffer } from "../utils/csvParser.js";
import { validateBulkRows } from "../utils/bulkValidator.js";
import { AppError } from "../utils/appError.js";
import { MESSAGES } from "../constants/messages.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";



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
  // Parse CSV buffer into row objects
  const rows = await parseCsvBuffer(file.buffer);

  // Generate batch ID
  const lastBatch = await getLastBatchId();
  const lastBatchNumber = Number(lastBatch?.batchId?.split("_")[1]) || 0;
  const newBatchId = `batch_${ lastBatchNumber + 1 }`;

  // Validate each row against the schema
  const { validPrograms, errors } = validateBulkRows(rows, training_providerId ?? '', newBatchId);

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
import { getEnrollmentActivities, getTodayEnrollmentCount, getTotalEnrollments } from "../repositories/enrollment.repository.js";
import { getAttendanceActivities, getTodayAttendanceTaken } from "../repositories/attendance.repository.js";

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

//

export const getTrainingProviderDashboardServices = async (
  trainingProviderId: string
) => {

  const [
    livePrograms,
    drafts,
    totalEnrollments,
    averageFillRate,
    topPrograms,
    recentActivities,
    todayEnrollmentCount,
    todayAttendance
  ] = await Promise.all([

    getLiveProgramsCount(
      trainingProviderId
    ),

    getDraftProgramsCount(
      trainingProviderId
    ),

    getTotalEnrollments(
      trainingProviderId
    ),

    getAverageFillRate(
      trainingProviderId
    ),

    getTopPrograms(
      trainingProviderId
    ),

    getRecentActivities(trainingProviderId),

    getTodayEnrollmentCount(
      trainingProviderId
    ),

    getTodayAttendanceTaken(
      trainingProviderId
    )
  ]);

  return {
    overview: {
      livePrograms,
      drafts,
      totalEnrollments,
      averageFillRate,
      todayEnrollmentCount,
      todayAttendance
    },

    topPrograms,

    recentActivities
  };
};



// ====================================
// RECENT ACTIVITIES
// ====================================

const getRecentActivities = async (
  trainingProviderId: string
) => {

  const [
    publishedActivities,
    draftActivities,
    bulkUploadActivities,
    enrollmentActivities,
    attendanceActivities
  ] = await Promise.all([

    getPublishedActivities(
      trainingProviderId
    ),

    getDraftActivities(
      trainingProviderId
    ),

    getBulkUploadActivities(
      trainingProviderId
    ),

    getEnrollmentActivities(
      trainingProviderId
    ),

    getAttendanceActivities(
      trainingProviderId
    )
  ]);

  const activities = [
    ...publishedActivities,
    ...draftActivities,
    ...bulkUploadActivities,
    ...enrollmentActivities,
    ...attendanceActivities
  ];

  activities.sort(
    (a: any, b: any) =>
      new Date(b.time).getTime() -
      new Date(a.time).getTime()
  );

  return activities.slice(0, 10);
};