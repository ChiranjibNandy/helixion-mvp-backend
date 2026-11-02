import express from "express";
import { login, logout, resetPasswordController, sendResetLinkController, sendBulkResetLinksController, signup } from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { loginSchema, resetPasswordSchema, sendBulkResetMailSchema, sendResetMailSchema, signupSchema } from "../validators/auth.validator.js";
import { rateLimiter } from "../middlewares/rateLimit.middleware.js";
import { authenticate, authorizeRole } from "../middlewares/authorizeRole.middleware.js";
import { ORG_ROLE } from "../constants/enum.js";


const router = express.Router();

router.post("/register", validate({ body: signupSchema }), signup);
router.post("/login", validate({ body: loginSchema }), login);
router.post("/logout", logout);
router.post("/send-reset-link", rateLimiter, validate({ body: sendResetMailSchema }), sendResetLinkController);
router.post("/admin/send-reset-link", authenticate, authorizeRole(ORG_ROLE.ADMIN), rateLimiter, validate({ body: sendBulkResetMailSchema }), sendBulkResetLinksController);
router.patch("/reset-password", validate({ body: resetPasswordSchema }), resetPasswordController);


export default router;