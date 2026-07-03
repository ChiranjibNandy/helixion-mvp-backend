import express from "express";
import { authenticate, authorizeRole, requirePasswordChange } from "../middlewares/authorizeRole.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { ORG_ROLE } from "../constants/enum.js";
import {
   getPendingEnrollments,
   takeManagerAction,
   getPendingReimbursements,
   takeReimbursementManagerAction,
} from "../controllers/manager.controller.js";
import {
   reimbursementEnrollmentParamsSchema,
   reimbursementManagerActionBodySchema,
} from "../validators/manager.validator.js";

const router = express.Router();

router.use(authenticate, requirePasswordChange, authorizeRole(ORG_ROLE.EMPLOYEE));

router.get("/pending", getPendingEnrollments);

router.patch("/enrollments/:id/action", takeManagerAction);

router.get("/reimbursements/pending", getPendingReimbursements);

router.patch(
   "/enrollments/:enrollmentId/reimbursement-action",
   validate({ params: reimbursementEnrollmentParamsSchema, body: reimbursementManagerActionBodySchema }),
   takeReimbursementManagerAction
);

export default router;
