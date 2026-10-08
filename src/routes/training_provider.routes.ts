import express from "express";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createProgramSchema,
  updateProgramSchema,
  updatePublishedProgramSchema,
  confirmEnrollmentParamsSchema,
  confirmEnrollmentBodySchema,
} from "../validators/training_provider.validator.js";
import {
  bulkCreateProgram,
  createProgram,
  deleteDraft,
  getDraftById,
  getDraftPrograms,
  getTrainingProviderDashboard,
  publishDraft,
  updateDraft,
  getPendingTpConfirmations,
  confirmEnrollment,
  declineEnrollment,
} from "../controllers/training_provider.controller.js";
import { ORG_ROLE } from "../constants/enum.js";
import { authenticate, authorizeRole, requirePasswordChange } from "../middlewares/authorizeRole.middleware.js";
import { upload, uploadBulkFile } from "../middlewares/multer.middleware.js";
import { rateLimiter } from "../middlewares/rateLimit.middleware.js";
import { getProgramParticipantsController, getPrograms, searchPublishedProgramsController, updatePublishedProgram } from "../controllers/program.controller.js";
import { searchUsersQuerySchema } from "../validators/common.validator.js";
import { generateProgramInvoice, getInvoiceCompanies, listProgramInvoices, downloadInvoicePdf } from "../controllers/invoice.controller.js";
import { generateInvoiceBodySchema, invoiceIdParamsSchema, invoiceProgramParamsSchema } from "../validators/invoice.validator.js";
import {
  getProgramAttendanceGridController,
  markAttendanceDayController,
  updateAttendanceNotesController,
} from "../controllers/attendanceRecord.controller.js";
import {
  attendanceGridQuerySchema,
  attendanceParamsSchema,
  markAttendanceDayBodySchema,
  updateAttendanceNotesBodySchema,
} from "../validators/attendanceRecord.validator.js";


const router = express.Router();


router.use(authenticate, requirePasswordChange, authorizeRole(ORG_ROLE.TRAINING_PROVIDER));


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
  uploadBulkFile.single("file"),
  bulkCreateProgram
);

//Get all published and paginated program created by taining provider

router.get(
  "/programs",
  validate({ query: searchUsersQuerySchema }),
  searchPublishedProgramsController
);


router.get(
  "/programs/list",
  validate({ query: searchUsersQuerySchema }),
  getPrograms
);

router.get(
  "/programs/:id/participants",
  getProgramParticipantsController
);
// Daily attendance grid (tickets 0058/0059)
router.get(
  "/programs/:id/attendance",
  validate({ query: attendanceGridQuerySchema }),
  getProgramAttendanceGridController
);

router.patch(
  "/programs/:id/attendance/:enrollmentId",
  validate({ params: attendanceParamsSchema, body: markAttendanceDayBodySchema }),
  markAttendanceDayController
);

router.patch(
  "/programs/:id/attendance/:enrollmentId/notes",
  validate({ params: attendanceParamsSchema, body: updateAttendanceNotesBodySchema }),
  updateAttendanceNotesController
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

router.patch(
  "/program/:id",
  validate({ body: updatePublishedProgramSchema }),
  updatePublishedProgram
)

router.get(
  "/enrollments/pending-confirmations",
  getPendingTpConfirmations
);

router.patch(
  "/programs/:programId/enrollments/:enrollmentId/confirm",
  validate({ params: confirmEnrollmentParamsSchema, body: confirmEnrollmentBodySchema }),
  confirmEnrollment
);

router.patch(
  "/programs/:programId/enrollments/:enrollmentId/decline",
  validate({ params: confirmEnrollmentParamsSchema, body: confirmEnrollmentBodySchema }),
  declineEnrollment
);

router.get(
  "/programs/:id/invoice-companies",
  validate({ params: invoiceProgramParamsSchema }),
  getInvoiceCompanies
);

router.post(
  "/programs/:id/invoices",
  validate({ params: invoiceProgramParamsSchema, body: generateInvoiceBodySchema }),
  generateProgramInvoice
);

router.get(
  "/programs/:id/invoices",
  validate({ params: invoiceProgramParamsSchema }),
  listProgramInvoices
);

router.get(
  "/invoices/:invoiceId/pdf",
  validate({ params: invoiceIdParamsSchema }),
  downloadInvoicePdf
);

export default router;