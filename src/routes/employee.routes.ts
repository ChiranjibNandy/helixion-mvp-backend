import express from "express";
import { authorizeRole } from "../middlewares/authorizeRole.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { ROLE } from "../constants/enum.js";
import {
   getEmployeeDashboard,
   getEmployeeProgramsList,
   getEmployeeProgramById,
   enrollInProgram,
   getEmployeeEnrollments,
   getEnrollmentDetails,
   updateTravelDetails,
   submitEnrollment
} from "../controllers/employee.controller.js";
import {
   getProgramsQuerySchema,
   programParamsSchema,
   enrollProgramBodySchema
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

router.get("/enrollments", getEmployeeEnrollments);

router.get("/enrollments/:id", getEnrollmentDetails);

router.put("/enrollments/:id/travel", updateTravelDetails);

router.post("/enrollments/:id/submit", submitEnrollment);

export default router;
