import { PROGRAM_SAVED_STATUS } from '../constants/enum.js';
import { IProgram } from '../interfaces/program.interface.js';
import Program from '../models/program.model.js'

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

export const getDraftProgramsRepo = async (
  providerId: string,
  skip: number,
  limit: number,
  search?: string
) => {
  const query: any = {
    training_providerId: providerId,
    status: PROGRAM_SAVED_STATUS.DRAFT,
  };

  if (search) {
    query.title = { $regex: search, $options: "i" };
  }

  const [programs, total] = await Promise.all([
    Program.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limit),
    Program.countDocuments(query),
  ]);

  return { programs, total };
};

export const getProgramByIdRepo = async (id: string, providerId: string) => {
  return await Program.findOne({ _id: id, training_providerId: providerId });
};

export const updateProgramRepo = async (id: string, providerId: string, data: Partial<IProgram>) => {
  return await Program.findOneAndUpdate(
    { _id: id, training_providerId: providerId },
    { $set: data },
    { returnDocument: 'after', runValidators: true }
  );
};

export const deleteProgramRepo = async (id: string, providerId: string) => {
  return await Program.findOneAndDelete({ _id: id, training_providerId: providerId });
};

