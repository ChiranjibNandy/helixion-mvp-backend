import dotenv from "dotenv";

dotenv.config();

export const ENV = {
  PORT: process.env.PORT || "5000",
  MONGO_URI: process.env.MONGO_URI || "",
  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET || "access-secret",
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || "refresh-secret",
  nodeEnv: process.env.NODE_ENV || "development",
  FRONTEND_URL:process.env.FRONTEND_URL
};