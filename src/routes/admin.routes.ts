import express from "express";

import { approveUser, getPendingRegistrations, deactivateUser, batchCreateUsers, searchUsers, getUsersController } from "../controllers/admin.controller.js";
import { approveUserBodySchema, batchCreateUsersBodySchema } from "../validators/admin.validator.js";
import { validate } from "../middlewares/validate.middleware.js";
import { authorizeRole } from "../middlewares/authorizeRole.middleware.js";
import { ROLE } from "../constants/enum.js";
import { IdParamsSchema, searchUsersQuerySchema } from "../validators/common.validator.js";
import { createOrganization, updatePolicy } from "../controllers/organization.controller.js";
import { createOrganizationSchema, updateOrganizationPolicySchema } from "../validators/organization.validator.js";

const router = express.Router();

router.use(authorizeRole(ROLE.ADMIN));

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
   validate({ params: IdParamsSchema, body: approveUserBodySchema }),
   approveUser
);

router.patch("/users/:id/deactivate",
   validate({ params: IdParamsSchema }),
   deactivateUser
);

//Organization

router.post("/create/organization",
   validate({ body: createOrganizationSchema }),
   createOrganization
);

router.patch(
   "/update/:id/policy",
   validate({ params: IdParamsSchema, body: updateOrganizationPolicySchema }),
   updatePolicy
);


export default router;