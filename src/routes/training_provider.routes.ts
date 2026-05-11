import express from "express";
import { validate } from "../middlewares/validate.middleware.js";
import { createProgramSchema } from "../validators/training_provider.validator.js";
import { bulkCreateProgram, createProgram } from "../controllers/training_provider.controller.js";
import { ROLE } from "../constants/enum.js";
import { authorizeRole } from "../middlewares/authorizeRole.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";


const router = express.Router();


router.use(authorizeRole(ROLE.TRAINING_PROVIDER));

//create programme

router.post(
  "/create/program",
  validate({ body: createProgramSchema }),
  upload.single("brochure"),
  createProgram
);

//Upload bulk program

router.post(
  "/programs/bulk",
  upload.single("file"),
  bulkCreateProgram
);

export default router;