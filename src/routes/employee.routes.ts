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
   submitTourForm,
   getEnrollmentPanelById,
} from "../controllers/employee.controller.js";
import { getEmployeeProgramAttendanceController } from "../controllers/attendanceRecord.controller.js";
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
import { addFeedback, getCompletedFeedbackPrograms } from "../controllers/feedback.controller.js";
import { addFeedbackSchema } from "../validators/feedback.validator.js";

const router = express.Router();

router.use(authenticate, requirePasswordChange, authorizeRole(ORG_ROLE.EMPLOYEE, ORG_ROLE.MANAGER));


router.get("/dashboard", getEmployeeDashboard);

router.get(
   "/programs",
   validate({ query: getProgramsQuerySchema }),
   getEmployeeProgramsList
);

router.get("/programs/:id", getEmployeeProgramById);

router.get(
   "/programs/:id/attendance",
   validate({ params: programParamsSchema }),
   getEmployeeProgramAttendanceController
);

router.post(
   "/programs/:id/enroll",
   validate({ params: programParamsSchema, body: enrollProgramBodySchema }),
   enrollInProgram
);

router.get("/enrollments", getEmployeeEnrollments);

router.get("/enrollments/panel/:id", getEnrollmentPanelById);

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

//completed program list api
router.get(
   "/feedback/programs",
   getCompletedFeedbackPrograms
);

router.post(
   "/feedback",
   validate({ body: addFeedbackSchema }),
   addFeedback
);

export default router;
