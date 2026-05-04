import express from "express";

import { approveUser, getPendingRegistrations, deactivateUser, batchCreateUsers ,searchUsers, getUsersController} from "../controllers/admin.controller.js";
import { approveUserBodySchema, approveUserParamsSchema, searchUsersQuerySchema, batchCreateUsersBodySchema } from "../validators/admin.validator.js";


import { validate } from "../middlewares/validate.middleware.js";
import { authorizeRole } from "../middlewares/authorizeRole.middleware.js";
import { ROLE } from "../constants/enum.js";

const router = express.Router();

router.use(authorizeRole(ROLE.ADMIN));

//all user
router.get("/users", validate({ query: searchUsersQuerySchema }),getUsersController);
//pending user
router.get("/registrations", validate({ query: searchUsersQuerySchema }), getPendingRegistrations);
//approved user
router.get("/users", validate({ query: searchUsersQuerySchema }), searchUsers);
router.post("/users/batch", validate({ body: batchCreateUsersBodySchema }), batchCreateUsers);
router.patch("/users/:id", validate({ params: approveUserParamsSchema, body: approveUserBodySchema }), approveUser);
router.patch("/users/:id/deactivate", validate({ params: approveUserParamsSchema }), deactivateUser);

export default router;