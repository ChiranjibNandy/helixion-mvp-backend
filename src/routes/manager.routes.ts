import express from "express";
import { authenticate, authorizeRole, requirePasswordChange } from "../middlewares/authorizeRole.middleware.js";
import { ORG_ROLE } from "../constants/enum.js";
import { getPendingEnrollments, getRelevantEnrollments, takeManagerAction } from "../controllers/manager.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { searchUsersQuerySchema } from "../validators/common.validator.js";


const router = express.Router();

router.use(authenticate, requirePasswordChange, authorizeRole(ORG_ROLE.EMPLOYEE));

router.get("/pending", getPendingEnrollments);

router.patch("/enrollments/:id/action", takeManagerAction);

//get relevent enrollment data for employees
router.get("/enrollments", validate({ query: searchUsersQuerySchema }), getRelevantEnrollments);

export default router;
