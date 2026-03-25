import express from "express";
import { login, signup } from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { loginSchema, signupSchema } from "../validators/auth.validator.js";


const router = express.Router();

router.post("/register", validate({ body: signupSchema }), signup);
router.post("/login", validate({ body: loginSchema }), login)

export default router;