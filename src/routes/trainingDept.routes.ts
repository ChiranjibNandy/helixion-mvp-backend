import express from "express";
import {
   authenticate,
   authorizeRole,
   authorizeOfficeRole,
   requirePasswordChange,
} from "../middlewares/authorizeRole.middleware.js";
import { ORG_ROLE } from "../constants/enum.js";
import {
   getPendingEnrollments,
   takeJuniorAction,
   takeSeniorAction,
} from "../controllers/trainingDept.controller.js";

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

export default router;
