import jwt from "jsonwebtoken";
import { ENV } from "../config/env.js";

export interface JwtPayloadType {
  userId: string;
  name:string;
  email: string;
  location:string;
  role?:string
}

export const generateAccessToken = (payload: JwtPayloadType) => {
  return jwt.sign(payload, ENV.accessTokenSecret, {
    expiresIn: "15m",
  });
};

export const generateRefreshToken = (payload: JwtPayloadType) => {
  return jwt.sign(payload, ENV.refreshTokenSecret, {
    expiresIn: "7d",
  });
};

export const verifyAccessToken = (token: string) => {
  return jwt.verify(token, ENV.accessTokenSecret) as JwtPayloadType;
};

export const verifyRefreshToken = (token: string) => {
  return jwt.verify(token, ENV.refreshTokenSecret) as JwtPayloadType;
};
