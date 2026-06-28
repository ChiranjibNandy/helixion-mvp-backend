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
   takeOsdJuniorAction,
   takeOsdSeniorAction,
} from "../controllers/osd.controller.js";

const router = express.Router();

/**
 * Authorization layering for all OSD routes (evaluated left-to-right):
 *
 *  1. authenticate          — verifies JWT, attaches userId / orgRole / officeRoles to req
 *  2. requirePasswordChange — blocks access until the user sets a permanent password
 *  3. authorizeRole(EMPLOYEE) — ensures the caller is a corporate employee.
 *                               Deliberately excludes ADMIN and TRAINING_PROVIDER;
 *                               OSD officers are always employees of the corporate org.
 *  4. authorizeOfficeRole(osd, N) — further restricts to users who hold the OSD
 *                               office role at level >= N (1 = junior, 2 = senior).
 *
 * Precedence rule: ORG_ROLE check (step 3) is a coarse gate; OFFICE_ROLE check
 * (step 4) is the fine-grained gate. Both must pass. There is no conflict —
 * the OFFICE_ROLE check is always layered on top of the ORG_ROLE check.
 */
router.use(authenticate, requirePasswordChange, authorizeRole(ORG_ROLE.EMPLOYEE));

/**
 * GET /api/osd/pending
 * Junior sees OSD_JUNIOR_REVIEW queue; senior sees OSD_SENIOR_REVIEW queue.
 * Level determined from JWT officeRoles.
 */
router.get(
   "/pending",
   authorizeOfficeRole("osd", 1),
   getPendingEnrollments
);

/**
 * PATCH /api/osd/enrollments/:id/junior-action
 * Body: { action: "return" | "recommend", note? }
 */
router.patch(
   "/enrollments/:id/junior-action",
   authorizeOfficeRole("osd", 1),
   takeOsdJuniorAction
);

/**
 * PATCH /api/osd/enrollments/:id/senior-action
 * Body: { action: "approve" | "reject", note? }
 */
router.patch(
   "/enrollments/:id/senior-action",
   authorizeOfficeRole("osd", 2),
   takeOsdSeniorAction
);

export default router;
