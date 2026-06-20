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
