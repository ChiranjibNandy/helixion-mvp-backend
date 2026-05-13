import { PROGRAM_SAVED_STATUS } from '../constants/enum.js';
import { IProgram } from '../interfaces/program.interface.js';
import Program from '../models/program.model.js'
import { GetPublishedProgramsParams } from '../types/program.js';

// Retrieve all active programs
export const getAvailableProgramsRepository = async () => {
  return await Program.find({
    status: PROGRAM_SAVED_STATUS.PUBLISHED
  })
};

//create program

export const createProgramRepo = async (data: IProgram) => {
  return await Program.create(data);
};


export const programBulkInsert = async (data: any[]) => {
  return await Program.insertMany(data);
};

export const getLastBatchId = async () => {
  return await Program.findOne({
    batchId: { $ne: null },
  }).sort({ createdAt: -1 });
};

//get all published program Repo

export const getPublishedProgramsRepository = async ({
  trainingProviderId,
  page,
  limit,
}: GetPublishedProgramsParams) => {
  const skip = (page - 1) * limit;

  const filter = {
    training_providerId: trainingProviderId,
    status: PROGRAM_SAVED_STATUS.PUBLISHED,
  };

  const [programs, total] = await Promise.all([
    Program.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Program.countDocuments(filter),
  ]);

  return {
    programs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

