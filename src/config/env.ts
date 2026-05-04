import dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const ENV = {
  PORT: process.env.PORT || "5000",
  MONGO_URI: requireEnv("MONGO_URI"),
  accessTokenSecret: requireEnv("ACCESS_TOKEN_SECRET"),
  refreshTokenSecret: requireEnv("REFRESH_TOKEN_SECRET"),
  nodeEnv: process.env.NODE_ENV || "development",
  FRONTEND_URL: requireEnv("FRONTEND_URL"),
  EMAIL_USER: requireEnv("EMAIL_USER"),
  EMAIL_PASS: requireEnv("EMAIL_PASS"),
  DEFAULT_PASSWORD: process.env.DEFAULT_PASSWORD || "Helixon@123",
};