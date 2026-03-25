import express from "express";
import { approveUser, getPendingRegistrations } from "../controllers/admin.controller.js";
import { pendingRegistrationsQuerySchema } from "../validators/admin.validator.js";
import { validate } from "../middlewares/validate.middleware.js";
import { adminAuthMiddleware } from "../middlewares/admin.middleware.js";


const router = express.Router();

router.use(adminAuthMiddleware);

router.get("/registrations", validate({ query: pendingRegistrationsQuerySchema }), getPendingRegistrations)
router.patch("/approve/:userId", approveUser)


export default router;