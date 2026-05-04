import cloudinary from "../config/cloudinary.js";
import { MESSAGES } from "../constants/messages.js";
import type { MulterFile } from "../types/multer.js";
import streamifier from "streamifier";

export const uploadToCloudinary = (file: MulterFile): Promise<string> => {
   return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
         {
            folder: "program-brochures",
         },
         (error, result) => {
            if (error) return reject(error);
            if (!result) return reject(new Error(MESSAGES.UPLOAD_FAIL));

            resolve(result.secure_url);
         }
      );

      streamifier.createReadStream(file.buffer).pipe(stream);
   });
};