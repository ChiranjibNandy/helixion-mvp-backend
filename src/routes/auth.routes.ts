import express from "express";
import { login, resetPasswordController, sendResetLinkController, signup } from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { loginSchema, resetPasswordSchema, sendResetMailSchema, signupSchema } from "../validators/auth.validator.js";


const router = express.Router();

router.post("/register", validate({ body: signupSchema }), signup);
router.post("/login", validate({ body: loginSchema }), login)
router.post("/send-reset-link", validate({ body: sendResetMailSchema }), sendResetLinkController);
router.patch("/reset-password", validate({ body: resetPasswordSchema }), resetPasswordController);

export default router;