import { programStatus } from '../constants/program-status.js';
import Program from '../models/program.model.js'

// Retrieve all active programs
export const getAvailableProgramsRepository = async () => {
  return await Program.find({
    status: programStatus.ACTIVE
  })
};