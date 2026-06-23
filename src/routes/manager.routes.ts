import express from "express";
import { getManagerDashboard } from "../controllers/manager.controller.js";
import { authorizeRole } from "../middlewares/authorizeRole.middleware.js";
import { ROLE } from "../constants/enum.js";

const router = express.Router();

router.use(authorizeRole(ROLE.MANAGER));

router.get("/dashboard", getManagerDashboard);

export default router;
