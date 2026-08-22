import express from "express";

import { approveUser, getPendingRegistrations, deactivateUser, activateUser, batchCreateUsers, searchUsers, getUsersController, createSingleUser, getAdminDashboardStats, getEmployeeById, updateEmployee } from "../controllers/admin.controller.js";
import { approveUserBodySchema, approveUserParamsSchema, batchCreateUsersBodySchema, createSingleUserSchema, updateEmployeeParamsSchema, updateEmployeeBodySchema } from "../validators/admin.validator.js";
import { validate } from "../middlewares/validate.middleware.js";
import { authenticate, authorizeRole, requirePasswordChange } from "../middlewares/authorizeRole.middleware.js";
import { ORG_ROLE } from "../constants/enum.js";
import { searchUsersQuerySchema } from "../validators/common.validator.js";
import { bulkUploadOrganizations, createOrganization, getAllOrganizations, getOrganizationById, getOrganizations, getOrganizationStatus, updateOrganizationDetails, updatePolicy } from "../controllers/organization.controller.js";
import { createOrganizationSchema, organizationIdParamSchema, updateOrganizationDetailsSchema, updatePolicySchema } from "../validators/organization.validator.js";
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


router.get("/users/:id",
   validate({ params: updateEmployeeParamsSchema }),
   getEmployeeById
);

router.patch("/users/:id/profile",
   validate({ params: updateEmployeeParamsSchema, body: updateEmployeeBodySchema }),
   updateEmployee
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

router.get("/organizations",
   validate({ query: searchUsersQuerySchema }),
   getOrganizations
);

router.get("/organizations/status", getOrganizationStatus);

router.get("/organizations/all",
   validate({ query: searchUsersQuerySchema }),
   getAllOrganizations
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

router.get(
   "/organizations/:organizationId",
   validate({ params: organizationIdParamSchema }),
   getOrganizationById
);

router.patch(
   "/organizations/:organizationId",
   validate({ params: organizationIdParamSchema, body: updateOrganizationDetailsSchema }),
   updateOrganizationDetails
);

export default router;