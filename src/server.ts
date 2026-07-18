import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import app from "./app.js";
import { ENV } from "./config/env.js";
import { startOsdTimeoutCron } from "./cron/osdTimeout.cron.js";

dotenv.config();

connectDB();
startOsdTimeoutCron();

app.listen(ENV.PORT, () => {
  console.log(`Server running on port ${ENV.PORT}`);
});