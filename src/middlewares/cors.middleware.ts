import cors from "cors";
import { ENV } from "../config/env.js";

export const corsMiddleware = cors({
  origin: ENV.FRONTEND_URL,
  credentials: true
});