import express from "express";
import { validate } from "../middlewares/validate.middleware.js";
import { createProgramSchema, updateProgramSchema } from "../validators/training_provider.validator.js";
import { bulkCreateProgram, createProgram, deleteDraft, getDraftById, getDraftPrograms, getTrainingProviderDashboard, publishDraft, updateDraft } from "../controllers/training_provider.controller.js";
import { ROLE } from "../constants/enum.js";
import { authorizeRole } from "../middlewares/authorizeRole.middleware.js";
import { upload, uploadCsv } from "../middlewares/multer.middleware.js";
import { rateLimiter } from "../middlewares/rateLimit.middleware.js";
import { getProgramParticipantsController, searchPublishedProgramsController } from "../controllers/program.controller.js";
import { searchUsersQuerySchema } from "../validators/common.validator.js";
import { getProgramAttendanceController, takeAttendanceController, updateParticipantAttendanceController } from "../controllers/attendance.controller.js";
import { takeAttendanceBodySchema } from "../validators/attendance.validator.js";


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

//Get all published and paginated program created by taining provider

router.get(
  "/programs",
  validate({ query: searchUsersQuerySchema }),
  searchPublishedProgramsController
);

router.get(
  "/programs/:id/participants",
  getProgramParticipantsController
);
//router for take attendance
router.put(
  "/programs/:id/attendance",
  validate({
    body: takeAttendanceBodySchema,
  }),
  takeAttendanceController
);
//fetch attendance data for edit
router.get(
  "/programs/:id/attendance",
  getProgramAttendanceController
);

//take single attendance router
router.patch(
  "/programs/:id/attendance/:pid",
  updateParticipantAttendanceController
);

// Drafts endpoints
router.get(
  "/programs/drafts",
  getDraftPrograms
);

router.get(
  "/programs/:id",
  getDraftById
);

router.put(
  "/programs/:id",
  upload.single("brochure"),
  validate({ body: updateProgramSchema }),
  updateDraft
);

router.patch(
  "/programs/:id/publish",
  publishDraft
);

router.delete(
  "/programs/:id",
  deleteDraft
);
//get training provider dashboard data
router.get(
  "/dashboard",
  getTrainingProviderDashboard
);

export default router;