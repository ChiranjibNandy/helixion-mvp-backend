import multer from "multer";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { AppError } from "../utils/appError.js";
import { MESSAGES } from "../constants/messages.js";
import path from "path";

export const upload = multer({
   storage: multer.memoryStorage(),
});

export const uploadCsv = multer({
   storage: multer.memoryStorage(),

   limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
   },

   fileFilter: (req, file, cb) => {
      const allowedMimeTypes = [
         "text/csv",
         "application/csv",
         "application/vnd.ms-excel", 
         "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];

      const allowedExtensions = [".csv", ".xls", ".xlsx"];

      const extension = path.extname(file.originalname).toLowerCase();

      if (
         !allowedMimeTypes.includes(file.mimetype) &&
         !allowedExtensions.includes(extension)
      ) {
         return cb(
            new AppError(
               "Only .csv, .xls and .xlsx files are allowed.",
               HTTP_STATUS.BAD_REQUEST
            )
         );
      }

      cb(null, true);
   },
});