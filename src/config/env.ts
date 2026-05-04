import dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${ name }`);
  }

  return value;
}

export const ENV = {
  PORT: requireEnv("PORT"),
  MONGO_URI: requireEnv("MONGO_URI"),
  accessTokenSecret: requireEnv("ACCESS_TOKEN_SECRET"),
  refreshTokenSecret: requireEnv("REFRESH_TOKEN_SECRET"),
  nodeEnv: process.env.NODE_ENV || "development",
  FRONTEND_URL: requireEnv("FRONTEND_URL"),
  EMAIL_USER: requireEnv("EMAIL_USER"),
  EMAIL_PASS: requireEnv("EMAIL_PASS"),
  CLOUDINARY_CLOUD_NAME: requireEnv("CLOUDINARY_CLOUD_NAME"),
  CLOUDINARY_API_KEY: requireEnv("CLOUDINARY_API_KEY"),
  CLOUDINARY_API_SECRET: requireEnv("CLOUDINARY_API_SECRET"),
  DEFAULT_PASSWORD: process.env.DEFAULT_PASSWORD || "Helixon@123",
};