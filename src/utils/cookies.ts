import { Response } from "express";
import { ENV } from "../config/env.js";

export const setRefreshTokenCookie = (res: Response, token: string) => {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: ENV.nodeEnv === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

export const setAccessTokenCookie = (res: Response, token: string) => {
  res.cookie("accessToken", token, {
    httpOnly: true,
    secure: ENV.nodeEnv === "production",
    sameSite: "lax",
    maxAge: 15 * 60 * 1000, // 15 minutes 
  });
};


export const clearRefreshTokenCookie = (res: Response) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: ENV.nodeEnv === "production",
    sameSite: "strict",
  });
};

export const clearAccessTokenCookie = (res: Response) => {
  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: ENV.nodeEnv === "production",
    sameSite: "strict",
  });
};
