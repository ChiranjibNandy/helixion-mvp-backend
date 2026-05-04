import express from "express";
import { getDashboardEnrollments } from "../controllers/employee.controller.js";
import { authorizeRole } from "../middlewares/authorizeRole.middleware.js";
import { ROLE } from "../constants/enum.js";


const router = express.Router();

router.use(authorizeRole(ROLE.EMPLOYEE));

router.get("/dashboard", getDashboardEnrollments);


export default router;