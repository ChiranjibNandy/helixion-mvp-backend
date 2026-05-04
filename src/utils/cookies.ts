import { Response } from "express";
import { ENV } from "../config/env.js";

const isProduction = ENV.nodeEnv === "production";

export const setRefreshTokenCookie = (res: Response, token: string) => {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

export const setAccessTokenCookie = (res: Response, token: string) => {
  res.cookie("accessToken", token, {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    maxAge: 15 * 60 * 1000, // 15 minutes 
  });
};


export const clearRefreshTokenCookie = (res: Response) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
  });
};

export const clearAccessTokenCookie = (res: Response) => {
  res.clearCookie("accessToken", {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
  });
};
