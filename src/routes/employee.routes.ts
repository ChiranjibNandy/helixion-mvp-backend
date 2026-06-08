import express from "express";
import {
  getEmployeeDashboard,
  getAvailablePrograms,
  enrollInProgram,
} from "../controllers/employee.controller.js";
import { authorizeRole } from "../middlewares/authorizeRole.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { ROLE } from "../constants/enum.js";
import {
  getProgramsQuerySchema,
  programParamsSchema,
  enrollProgramBodySchema,
} from "../validators/employee.validator.js";

const router = express.Router();

router.use(authorizeRole(ROLE.EMPLOYEE));

router.get("/dashboard", getEmployeeDashboard);

router.get(
  "/programs",
  validate({ query: getProgramsQuerySchema }),
  getAvailablePrograms
);

router.post(
  "/programs/:id/enroll",
  validate({ params: programParamsSchema, body: enrollProgramBodySchema }),
  enrollInProgram
);

export default router;
