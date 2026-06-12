import cors from "cors";
import { ENV } from "../config/env.js";

const allowedOrigins = [
  ENV.FRONTEND_URL.replace(/\/$/, ""),
  "http://localhost:3000",
];

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    const normalizedOrigin = origin?.replace(/\/$/, "");
    if (!normalizedOrigin || allowedOrigins.includes(normalizedOrigin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});