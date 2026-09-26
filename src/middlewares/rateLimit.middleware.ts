import rateLimit from "express-rate-limit";
import { MESSAGES } from "../constants/messages.js";

export const rateLimiter = rateLimit({
   windowMs: 15 * 60 * 1000,
   max: 100,
   message: MESSAGES.RATE_LIMIT
});