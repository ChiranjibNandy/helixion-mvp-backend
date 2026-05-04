import { IProgram } from "../interfaces/program.interface.js";
import { createProgramRepo } from "../repositories/program.repository.js";


export const createProgramService = async (data: IProgram) => {
  return await createProgramRepo(data);
};