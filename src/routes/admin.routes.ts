import express from "express";

import { approveUser, getPendingRegistrations, deactivateUser, batchCreateUsers, searchUsers, getUsersController } from "../controllers/admin.controller.js";
import { approveUserBodySchema, approveUserParamsSchema, batchCreateUsersBodySchema } from "../validators/admin.validator.js";

import { validate } from "../middlewares/validate.middleware.js";
import { authenticate, authorizeRole, requirePasswordChange } from "../middlewares/authorizeRole.middleware.js";
import { ORG_ROLE } from "../constants/enum.js";
import { searchUsersQuerySchema } from "../validators/common.validator.js";

const router = express.Router();

router.use(authenticate, requirePasswordChange, authorizeRole(ORG_ROLE.ADMIN));


//all users (for reset-password flow)
router.get("/users",
   validate({ query: searchUsersQuerySchema }),
   getUsersController
);
//pending user
router.get("/registrations", 
   validate({ query: searchUsersQuerySchema }), 
   getPendingRegistrations
);
//search approved users (for deactivate flow)
router.get("/users/search", 
   validate({ query: searchUsersQuerySchema }), 
   searchUsers
);

router.post("/users/batch", 
   validate({ body: batchCreateUsersBodySchema }),
   batchCreateUsers
);

router.patch("/users/:id", 
   validate({ params: approveUserParamsSchema, body: approveUserBodySchema }), 
   approveUser
);

router.patch("/users/:id/deactivate", 
   validate({ params: approveUserParamsSchema }), 
   deactivateUser
);

export default router;