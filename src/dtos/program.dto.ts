import { IProgram } from "../interfaces/program.interface.js";
import { MulterFile } from "../types/multer.js";

export interface createProgramReq extends IProgram {
   file:MulterFile
}