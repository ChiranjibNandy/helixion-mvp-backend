import express from "express";

import { approveUser, getPendingRegistrations, deactivateUser, activateUser, batchCreateUsers, searchUsers, getUsersController, createSingleUser, getAdminDashboardStats } from "../controllers/admin.controller.js";
import { approveUserBodySchema, approveUserParamsSchema, batchCreateUsersBodySchema, createSingleUserSchema } from "../validators/admin.validator.js";
import { validate } from "../middlewares/validate.middleware.js";
import { authenticate, authorizeRole, requirePasswordChange } from "../middlewares/authorizeRole.middleware.js";
import { ORG_ROLE } from "../constants/enum.js";
import { searchUsersQuerySchema } from "../validators/common.validator.js";
import { bulkUploadOrganizations, createOrganization, getOrganizationStatus, updatePolicy } from "../controllers/organization.controller.js";
import { createOrganizationSchema, organizationIdParamSchema, updatePolicySchema } from "../validators/organization.validator.js";
import { uploadCsv } from "../middlewares/multer.middleware.js";
import { rateLimiter } from "../middlewares/rateLimit.middleware.js";

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

// dashboard summary counts (org-scoped)
router.get("/dashboard/stats", getAdminDashboardStats);

router.post("/users/batch",
   uploadCsv.single("file"),
   batchCreateUsers
);

// Single-employee creation — the only path that can create someone with no
// reporting manager (bulk upload now requires one on every row).
router.post("/users",
   validate({ body: createSingleUserSchema }),
   createSingleUser
);

router.patch("/users/:id",
   validate({ params: approveUserParamsSchema, body: approveUserBodySchema }),
   approveUser
);

router.patch("/users/:id/deactivate",
   validate({ params: approveUserParamsSchema }),
   deactivateUser
);

router.patch("/users/:id/activate",
   validate({ params: approveUserParamsSchema }),
   activateUser
);

router.post("/organizations",
   validate({ body: createOrganizationSchema }),
   createOrganization
);

router.get("/organizations/status", getOrganizationStatus);

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