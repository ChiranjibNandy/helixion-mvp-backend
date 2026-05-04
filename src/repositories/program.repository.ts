import { PROGRAM_STATUS } from '../constants/enum.js';
import { IProgram } from '../interfaces/program.interface.js';
import Program from '../models/program.model.js'

// Retrieve all active programs
export const getAvailableProgramsRepository = async () => {
  return await Program.find({
    status: PROGRAM_STATUS.ACTIVE
  })
};

export const createProgramRepo = async (data: IProgram) => {
  return await Program.create(data);
};

export const programBulkInsert = async (data: any[]) => {
  return await Program.insertMany(data);
};