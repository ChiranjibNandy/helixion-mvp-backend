import express from "express";
import { validate } from "../middlewares/validate.middleware.js";
import { createProgramSchema } from "../validators/training_provider.validator.js";
import { bulkCreateProgram, createProgram } from "../controllers/training_provider.controller.js";
import { ROLE } from "../constants/enum.js";
import { authorizeRole } from "../middlewares/authorizeRole.middleware.js";
import { upload, uploadCsv } from "../middlewares/multer.middleware.js";
import { rateLimiter } from "../middlewares/rateLimit.middleware.js";


const router = express.Router();


router.use(authorizeRole(ROLE.TRAINING_PROVIDER));

//create programme

router.post(
  "/create/program",
  upload.single("brochure"),
  validate({ body: createProgramSchema }),
  createProgram
);

//Upload bulk program

router.post(
  "/programs/bulk",
  rateLimiter,
  uploadCsv.single("file"),
  bulkCreateProgram
);

// Drafts endpoints
import { getDraftPrograms, getDraftById, updateDraft, publishDraft, deleteDraft } from "../controllers/training_provider.controller.js";
import { updateProgramSchema } from "../validators/training_provider.validator.js";

router.get("/programs/drafts", getDraftPrograms);

router.get("/programs/:id", getDraftById);

router.put(
  "/programs/:id",
  upload.single("brochure"),
  validate({ body: updateProgramSchema }),
  updateDraft
);

router.patch("/programs/:id/publish", publishDraft);

router.delete("/programs/:id", deleteDraft);

export default router;