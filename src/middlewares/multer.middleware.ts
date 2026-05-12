import multer from "multer";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { AppError } from "../utils/appError.js";
import { MESSAGES } from "../constants/messages.js";

export const upload = multer({
   storage: multer.memoryStorage(),
});

// CSV upload middleware
export const uploadCsv = multer({
   storage: multer.memoryStorage(),

   limits: {
      fileSize: 2 * 1024 * 1024, // 2MB
   },

   fileFilter: (req, file, cb) => {
      const allowedMimeTypes = [
         "text/csv",
         "application/vnd.ms-excel",
      ];

      if (!allowedMimeTypes.includes(file.mimetype)) {
         return cb(
            new AppError(
               MESSAGES.CSV_ALLOWED,
               HTTP_STATUS.BAD_REQUEST
            )
         );
      }

      cb(null, true);
   },
});