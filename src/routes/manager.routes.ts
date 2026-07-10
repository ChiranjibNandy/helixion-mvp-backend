import express from "express";
import { authenticate, authorizeRole, requirePasswordChange } from "../middlewares/authorizeRole.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { ORG_ROLE } from "../constants/enum.js";
<<<<<<< Updated upstream
import { getPendingEnrollments, getPendingReimbursements, getRelevantEnrollments, takeManagerAction, takeReimbursementManagerAction } from "../controllers/manager.controller.js";
=======
import {
   getPendingEnrollments,
   getPendingReimbursements,
   getRelevantEnrollments,
   takeManagerAction,
   takeReimbursementManagerAction,
   getManagerDashboard,
   getEmployeeTrainingHistory,
} from "../controllers/manager.controller.js";
>>>>>>> Stashed changes
import { searchUsersQuerySchema } from "../validators/common.validator.js";

import {
   reimbursementEnrollmentParamsSchema,
   reimbursementManagerActionBodySchema,
} from "../validators/manager.validator.js";

const router = express.Router();

router.use(authenticate, requirePasswordChange, authorizeRole(ORG_ROLE.EMPLOYEE));

router.get("/pending", getPendingEnrollments);

router.patch("/enrollments/:id/action", takeManagerAction);

//get relevent enrollment data for employees
router.get("/enrollments", validate({ query: searchUsersQuerySchema }), getRelevantEnrollments);

router.get("/enrollments/:enrollmentId/training-history", getEmployeeTrainingHistory);

router.get("/reimbursements/pending", getPendingReimbursements);

router.patch(
   "/enrollments/:enrollmentId/reimbursement-action",
   validate({ params: reimbursementEnrollmentParamsSchema, body: reimbursementManagerActionBodySchema }),
   takeReimbursementManagerAction
);


export default router;
