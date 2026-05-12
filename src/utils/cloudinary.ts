import cloudinary from "../config/cloudinary.js";
import { MESSAGES } from "../constants/messages.js";
import type { MulterFile } from "../types/multer.js";
import streamifier from "streamifier";

type CloudinaryUploadResult = {
   secure_url: string;
   public_id: string;
};

export const uploadToCloudinary = (
   file: MulterFile
): Promise<CloudinaryUploadResult> => {
   return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
         {
            folder: "program-brochures",
         },
         (error, result) => {
            if (error) return reject(error);

            if (!result) {
               return reject(new Error(MESSAGES.UPLOAD_FAIL));
            }

            resolve({
               secure_url: result.secure_url,
               public_id: result.public_id,
            });
         }
      );

      streamifier.createReadStream(file.buffer).pipe(stream);
   });
};