import express from "express";
import { authenticate, authorizeRole, requirePasswordChange } from "../middlewares/authorizeRole.middleware.js";
import { ORG_ROLE } from "../constants/enum.js";
import { getPendingEnrollments, takeManagerAction } from "../controllers/manager.controller.js";

const router = express.Router();

router.use(authenticate, requirePasswordChange, authorizeRole(ORG_ROLE.EMPLOYEE));

router.get("/pending", getPendingEnrollments);

router.patch("/enrollments/:id/action", takeManagerAction);

export default router;
