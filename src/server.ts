import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import app from "./app.js";
import { ENV } from "./config/env.js";
import { startOsdTimeoutCron } from "./cron/osdTimeout.cron.js";
import { reconcileOrphanedBulkUploadJobsService } from "./services/admin.service.js";

dotenv.config();

// Requests that arrive before Mongoose finishes connecting sit in its command
// buffer and fail with an opaque "buffering timed out" error instead of a
// clear connection error — waiting here means the server never accepts
// traffic before the DB is actually ready.
async function start() {
  await connectDB();
  startOsdTimeoutCron();
  await reconcileOrphanedBulkUploadJobsService();

  app.listen(ENV.PORT, () => {
    console.log(`Server running on port ${ENV.PORT}`);
  });
}

start();