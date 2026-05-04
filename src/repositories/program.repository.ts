import { PROGRAM_STATUS } from '../constants/enum.js';
import { IProgram } from '../interfaces/program.interface.js';
import Program from '../models/program.model.js'

// Retrieve all active programs
export const getAvailableProgramsRepository = async () => {
  return await Program.find({
    status: PROGRAM_STATUS.ACTIVE
  })
};

//create program

export const createProgramRepo = async (data: IProgram) => {
  return await Program.create(data);
};

//update program

export const updateProgramRepo = (_id: string, data: any) => {
  console.log(data)
  return Program.findByIdAndUpdate(
    _id,
    { $set: data },
    { new: true, runValidators: true }
  );
};

export const programBulkInsert = async (data: any[]) => {
  return await Program.insertMany(data);
};

