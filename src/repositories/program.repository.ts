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

