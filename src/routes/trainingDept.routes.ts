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
   takeJuniorAction,
   takeSeniorAction,
   getPendingTourApprovals,
   takeTourAction,
} from "../controllers/trainingDept.controller.js";
import {
   tourActionParamsSchema,
   tourCtdActionBodySchema,
} from "../validators/trainingDept.validator.js";

const router = express.Router();

// All training dept routes require authentication + employee org role
router.use(authenticate, requirePasswordChange, authorizeRole(ORG_ROLE.EMPLOYEE));

/**
 * GET /api/training-dept/pending
 * Accessible to both junior (level 1) and senior (level 2) officers
 */
router.get(
   "/pending",
   authorizeOfficeRole("trainingDept", 1),
   getPendingEnrollments
);

/**
 * PATCH /api/training-dept/enrollments/:id/junior-action
 * Only junior or senior officers (level >= 1)
 * Body: { action: "reviewed", note? }
 */
router.patch(
   "/enrollments/:id/junior-action",
   authorizeOfficeRole("trainingDept", 1),
   takeJuniorAction
);

/**
 * PATCH /api/training-dept/enrollments/:id/senior-action
 * Only senior officers (level >= 2)
 * Body: { action: "approve" | "reject", note? }
 */
router.patch(
   "/enrollments/:id/senior-action",
   authorizeOfficeRole("trainingDept", 2),
   takeSeniorAction
);

// ─────────────────────────────────────────────────────────────────────────────
// TOUR APPROVALS — final approval on the tour leg (replaces OSD's old role)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/training-dept/tour-approvals/pending
 */
router.get(
   "/tour-approvals/pending",
   authorizeOfficeRole("trainingDept", 1),
   getPendingTourApprovals
);

/**
 * PATCH /api/training-dept/enrollments/:id/tour-action
 * Body: { action: "approve" | "reject", note? }
 * Senior officers only (level >= 2), matching the main enrollment approve/reject gate.
 */
router.patch(
   "/enrollments/:id/tour-action",
   authorizeOfficeRole("trainingDept", 2),
   validate({ params: tourActionParamsSchema, body: tourCtdActionBodySchema }),
   takeTourAction
);

export default router;
