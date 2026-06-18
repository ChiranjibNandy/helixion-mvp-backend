import express from "express";

import { approveUser, getPendingRegistrations, deactivateUser, batchCreateUsers, searchUsers, getUsersController } from "../controllers/admin.controller.js";
import { approveUserBodySchema, approveUserParamsSchema, batchCreateUsersBodySchema } from "../validators/admin.validator.js";
import { validate } from "../middlewares/validate.middleware.js";
import { authorizeRole } from "../middlewares/authorizeRole.middleware.js";
import { ROLE } from "../constants/enum.js";
import { searchUsersQuerySchema } from "../validators/common.validator.js";
import { bulkUploadOrganizations, createOrganization, updatePolicy } from "../controllers/organization.controller.js";
import { createOrganizationSchema, organizationIdParamSchema, updatePolicySchema } from "../validators/organization.validator.js";
import { uploadCsv } from "../middlewares/multer.middleware.js";
import { rateLimiter } from "../middlewares/rateLimit.middleware.js";

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
   validate({ params: approveUserParamsSchema, body: approveUserBodySchema }),
   approveUser
);

router.patch("/users/:id/deactivate",
   validate({ params: approveUserParamsSchema }),
   deactivateUser
);

router.post("/organizations",
   validate({ body: createOrganizationSchema }),
   createOrganization
);

router.post(
   "/organizations/bulk-upload",
   rateLimiter,
   uploadCsv.single("file"),
   bulkUploadOrganizations
);

router.patch(
   "/organizations/:organizationId/policy",
   validate({ params: organizationIdParamSchema, body: updatePolicySchema }),
   updatePolicy
);

export default router;