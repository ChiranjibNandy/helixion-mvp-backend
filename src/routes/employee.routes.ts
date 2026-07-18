import express from "express";
import {
   getEmployeeDashboard,
   getEmployeeProgramsList,
   getEmployeeProgramById,
   enrollInProgram,
   getEmployeeEnrollments,
   getEnrollmentDetails,
   updateTravelDetails,
   submitEnrollment,
   submitReimbursement,
   getEmployeeNotifications,
   submitTourForm
} from "../controllers/employee.controller.js";
import { authenticate, authorizeRole, requirePasswordChange } from "../middlewares/authorizeRole.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { ORG_ROLE } from "../constants/enum.js";
import {
   getProgramsQuerySchema,
   programParamsSchema,
   enrollProgramBodySchema,
   submitReimbursementBodySchema,
   submitReimbursementParamsSchema,
   submitTourFormParamsSchema,
   submitTourFormBodySchema
} from "../validators/employee.validator.js";

const router = express.Router();

router.use(authenticate, requirePasswordChange, authorizeRole(ORG_ROLE.EMPLOYEE));


router.get("/dashboard", getEmployeeDashboard);

router.get(
   "/programs",
   validate({ query: getProgramsQuerySchema }),
   getEmployeeProgramsList
);

router.get("/programs/:id", getEmployeeProgramById);

router.post(
   "/programs/:id/enroll",
   validate({ params: programParamsSchema, body: enrollProgramBodySchema }),
   enrollInProgram
);

router.get("/notifications", getEmployeeNotifications);

router.get("/enrollments", getEmployeeEnrollments);

router.get("/enrollments/:id", getEnrollmentDetails);

router.put("/enrollments/:id/travel", updateTravelDetails);

router.post("/enrollments/:id/submit", submitEnrollment);

router.post(
   "/enrollments/:enrollmentId/reimbursement/submit",
   validate({ params: submitReimbursementParamsSchema, body: submitReimbursementBodySchema }),
   submitReimbursement
);

router.post(
   "/enrollments/:enrollmentId/tour/submit",
   validate({ params: submitTourFormParamsSchema, body: submitTourFormBodySchema }),
   submitTourForm
);

export default router;
