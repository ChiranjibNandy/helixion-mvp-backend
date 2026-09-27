import multer from "multer";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { AppError } from "../utils/appError.js";
import path from "path";
import { MESSAGES } from "../constants/messages.js";

export const upload = multer({
   storage: multer.memoryStorage(),
});

export const uploadBulkFile = multer({
   storage: multer.memoryStorage(),

   limits: {
      fileSize: 5 * 1024 * 1024, 
   },

   fileFilter: (req, file, cb) => {
      const allowedExtensions = [".csv", ".xls", ".xlsx"];

      const extension = path.extname(file.originalname).toLowerCase();

      if (!allowedExtensions.includes(extension)) {
         return cb(
            new AppError(
               MESSAGES.ONLY_ALLOW_FORMAT_FILE,
               HTTP_STATUS.BAD_REQUEST
            )
         );
      }

      cb(null, true);
   },
});