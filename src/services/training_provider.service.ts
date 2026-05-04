import { createProgramReq } from "../dtos/program.dto.js";
import { createProgramRepo } from "../repositories/program.repository.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";


export const createProgramService = async (data: createProgramReq) => {
  let brochureUrl: string | undefined;
  if (data.file) {
    brochureUrl = await uploadToCloudinary(data.file);
  }
  return await createProgramRepo({ ...data, brochureUrl });
};