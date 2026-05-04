import express from "express";
import { validate } from "../middlewares/validate.middleware.js";
import { createProgramSchema } from "../validators/training_provider.validator.js";
import { createProgram } from "../controllers/training_provider.controller.js";
import { ROLE } from "../constants/enum.js";
import { authorizeRole } from "../middlewares/authorizeRole.middleware.js";


const router = express.Router();


router.use(authorizeRole(ROLE.TRAINING_PROVIDER));

router.post(
   "/program",
   validate({ body: createProgramSchema }),
   createProgram
);

export default router;