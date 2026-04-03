import express from "express";
import { approveUser, getPendingRegistrations } from "../controllers/admin.controller.js";
import { approveUserBodySchema, approveUserParamsSchema, pendingRegistrationsQuerySchema } from "../validators/admin.validator.js";
import { validate } from "../middlewares/validate.middleware.js";
import { authorizeRole } from "../middlewares/authorizeRole.middleware.js";
import { ROLE } from "../constants/role.js";


const router = express.Router();

router.use(authorizeRole(ROLE.ADMIN));
//register the user
router.get("/registrations", validate({ query: pendingRegistrationsQuerySchema }), getPendingRegistrations)
//approve the user and assign the user 
router.patch("/users/:id", validate({params: approveUserParamsSchema,body: approveUserBodySchema}), approveUser)


export default router;