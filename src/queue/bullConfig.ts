import Bull from "bull";
import { ENV } from "../config/env.js";

export const uploadQueue = new Bull("bulk-upload", ENV.REDIS_URL);

uploadQueue.on("error", (err) => {
  console.error("[uploadQueue] Redis connection error:", err?.message || err);
});
