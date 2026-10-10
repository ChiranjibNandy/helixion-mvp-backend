import { Router } from "express";
import {
  getSettingsProfile,
  updateSettingsProfile,
} from "../controllers/settings.controller.js";
import {
  authenticate,
  authorizeRole,
  requirePasswordChange,
} from "../middlewares/authorizeRole.middleware.js";
import { getSettingsUpdateSchema } from "../validators/settings.validator.js";
import { ORG_ROLE } from "../constants/enum.js";

const router = Router();

router.use(
  authenticate,
  requirePasswordChange,
);

router.get(
  "/profile",
  getSettingsProfile
);

router.use(
  authorizeRole(
    ORG_ROLE.ADMIN,
    ORG_ROLE.TRAINING_PROVIDER
  ))

router.put(
  "/profile",
  getSettingsUpdateSchema,
  updateSettingsProfile
);

export default router;
