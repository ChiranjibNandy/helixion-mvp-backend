import express from "express";
import { authenticate, authorizeRole, requirePasswordChange } from "../middlewares/authorizeRole.middleware.js";
import { ORG_ROLE } from "../constants/enum.js";
import { getPendingEnrollments, takeManagerAction } from "../controllers/manager.controller.js";

const router = express.Router();

/**
 * Managers are employees who appear in other employees' managerChain.
 * There is no separate "manager" org role — they are authenticated as
 * employees and the RBAC for manager-specific actions is enforced by
 * checking the enrollment's managerChain at the service level.
 */
router.use(authenticate, requirePasswordChange, authorizeRole(ORG_ROLE.EMPLOYEE));

/**
 * GET /api/manager/pending
 * Query: ?level=1 (direct reports only, default) | ?level=0 (all chain levels)
 */
router.get("/pending", getPendingEnrollments);

/**
 * PATCH /api/manager/enrollments/:id/action
 * Body: { action: "recommend" | "approve" | "reject", note?: string }
 */
router.patch("/enrollments/:id/action", takeManagerAction);

export default router;
