import express from "express";
import {
   authenticate,
   authorizeRole,
   authorizeOfficeRole,
   requirePasswordChange,
} from "../middlewares/authorizeRole.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { ORG_ROLE } from "../constants/enum.js";
import {
   getPendingEnrollments,
   takeReimbursementOsdAction,
} from "../controllers/osd.controller.js";
import {
   enrollmentParamsSchema,
   reimbursementOsdActionBodySchema,
} from "../validators/osd.validator.js";

const router = express.Router();

/**
 * Authorization layering for all OSD routes (evaluated left-to-right):
 *
 *  1. authenticate          — verifies JWT, attaches userId / orgRole / officeRoles to req
 *  2. requirePasswordChange — blocks access until the user sets a permanent password
 *  3. authorizeRole(EMPLOYEE) — ensures the caller is a corporate employee.
 *                               Deliberately excludes ADMIN and TRAINING_PROVIDER;
 *                               OSD officers are always employees of the corporate org.
 *  4. authorizeOfficeRole(osd, 1) — further restricts to users who hold the OSD
 *                               office role. Single-tier gate (ticket 0031) — no
 *                               junior/senior level distinction, any OSD officer
 *                               can act.
 *
 * Precedence rule: ORG_ROLE check (step 3) is a coarse gate; OFFICE_ROLE check
 * (step 4) is the fine-grained gate. Both must pass.
 */
router.use(authenticate, requirePasswordChange, authorizeRole(ORG_ROLE.EMPLOYEE));

/**
 * GET /api/osd/reimbursements/pending
 */
router.get(
   "/reimbursements/pending",
   authorizeOfficeRole("osd", 1),
   getPendingEnrollments
);

/**
 * PATCH /api/osd/enrollments/:id/reimbursement-action
 * Body: { action: "approve" | "reject", note? }
 */
router.patch(
   "/enrollments/:id/reimbursement-action",
   authorizeOfficeRole("osd", 1),
   validate({ params: enrollmentParamsSchema, body: reimbursementOsdActionBodySchema }),
   takeReimbursementOsdAction
);

export default router;
