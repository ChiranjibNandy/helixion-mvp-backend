import express from "express";
import { approveUser, getPendingRegistrations, deactivateUser, batchCreateUsers } from "../controllers/admin.controller.js";
import { approveUserBodySchema, approveUserParamsSchema, pendingRegistrationsQuerySchema, batchCreateUsersBodySchema } from "../validators/admin.validator.js";
import { validate } from "../middlewares/validate.middleware.js";
import { authorizeRole } from "../middlewares/authorizeRole.middleware.js";
import { ROLE } from "../constants/role.js";

const router = express.Router();

router.use(authorizeRole(ROLE.ADMIN));

router.get("/registrations", validate({ query: pendingRegistrationsQuerySchema }), getPendingRegistrations);
router.post("/users/batch", validate({ body: batchCreateUsersBodySchema }), batchCreateUsers);
router.patch("/users/:id", validate({ params: approveUserParamsSchema, body: approveUserBodySchema }), approveUser);
router.patch("/users/:id/deactivate", validate({ params: approveUserParamsSchema }), deactivateUser);

export default router;