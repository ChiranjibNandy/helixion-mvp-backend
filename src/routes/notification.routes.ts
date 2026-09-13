import express from "express";
import { authenticate, authorizeRole, requirePasswordChange } from "../middlewares/authorizeRole.middleware.js";
import { ORG_ROLE } from "../constants/enum.js";
import { markNotificationAsRead } from "../controllers/notification.controller.js";


const router = express.Router();

router.use(authenticate, requirePasswordChange, authorizeRole(ORG_ROLE.EMPLOYEE, ORG_ROLE.MANAGER,ORG_ROLE.TRAINING_PROVIDER));

router.patch(
   "/:id/read",
   markNotificationAsRead
);



export default router;
