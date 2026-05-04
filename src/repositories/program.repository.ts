import { PROGRAM_STATUS } from '../constants/enum.js';
import Program from '../models/program.model.js'

// Retrieve all active programs
export const getAvailableProgramsRepository = async () => {
  return await Program.find({
    status: PROGRAM_STATUS.ACTIVE
  })
};