import { NextFunction, Request, Response } from "express";
import { loginService, signupService } from "../services/auth.service.js";
import { MESSAGES } from "../constants/messages.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { generateAccessToken, generateRefreshToken, JwtPayloadType } from "../utils/jwt.js";
import { setAccessTokenCookie, setRefreshTokenCookie } from "../utils/cookies.js";
import { LoginRequestDto } from "../dtos/login.dto.js";

//register the user
export const signup = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await signupService(req.body);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: MESSAGES.USER_CREATED_SUCCESSFULLY,
    });

  } catch (error) {
    next(error);
  }
};
//login the user
export const login = async (
  req: Request<{}, {}, LoginRequestDto>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;

    const user = await loginService(
      email,
      password
    );

    // Safe payload for creating token
    const payload: JwtPayloadType = {
      userId: user._id!.toString(),
      name:user.username,
      email: user.email,
      location:user.location,
      role: user.role,
    };

    const accessToken = generateAccessToken(payload);

    const refreshToken = generateRefreshToken(payload);
    setRefreshTokenCookie(res, refreshToken);
    setAccessTokenCookie(res, accessToken)

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.USER_LOGGED_IN_SUCCESSFULLY,
    });

  } catch (error) {
    next(error);
  }
};