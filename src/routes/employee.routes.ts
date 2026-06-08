import express from "express";
import { authorizeRole } from "../middlewares/authorizeRole.middleware.js";
import { ROLE } from "../constants/enum.js";
import { getEmployeeDashboard } from "../controllers/employee.controller.js";


const router = express.Router();

router.use(authorizeRole(ROLE.EMPLOYEE));

router.get("/dashboard", getEmployeeDashboard);


export default router;