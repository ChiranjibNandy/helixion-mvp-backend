import { NextFunction, Request, Response } from "express";
import { loginService, resetPasswordService, sendResetLinkService, signupService } from "../services/auth.service.js";
import { MESSAGES } from "../constants/messages.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { generateAccessToken, generateRefreshToken, JwtPayloadType } from "../utils/jwt.js";
import { setAccessTokenCookie, setRefreshTokenCookie } from "../utils/cookies.js";
import { LoginRequestDto } from "../dtos/login.dto.js";

/**
 * Register a new user account.
 *
 * Route:
 * POST /api/auth/signup
 *
 * Access:
 * Public
 *
 * Body:
 * - username
 * - email
 * - password
 * - role (optional)
 * - description (optional)
 * - location (optional)
 *
 * Returns:
 * User registration success response
 */
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
/**
 * Authenticate user and issue access/refresh tokens.
 *
 * Route:
 * POST /api/auth/login
 *
 * Access:
 * Public
 *
 * Body:
 * - email
 * - password
 *
 * Returns:
 * Login success response
 * Sets access token and refresh token cookies
 */
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
      name: user.username,
      email: user.email,
      location: user.location,
      role: user.role,
    };

    const accessToken = generateAccessToken(payload);

    const refreshToken = generateRefreshToken(payload);
    setRefreshTokenCookie(res, refreshToken);
    setAccessTokenCookie(res, accessToken)

    console.log(accessToken)

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.USER_LOGGED_IN_SUCCESSFULLY
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Send password reset link to a registered user email.
 *
 * Route:
 * POST /api/auth/send-reset-link
 *
 * Access:
 * Public (or protected if admin initiated)
 *
 * Body:
 * - email
 *
 * Returns:
 * Reset link sent confirmation
 */
export const sendResetLinkController =
  async (
    req: Request,
    res: Response
  ) => {

    await sendResetLinkService(
      req.body.email
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message:
        MESSAGES.RESET_LINK_SENT
    });

  };

/**
 * Reset user password using userId and new password.
 *
 * Route:
 * PATCH /api/auth/reset-password
 *
 * Access:
 * Public (after reset link validation)
 *
 * Body:
 * - userId
 * - newPassword
 * - confirmPassword
 *
 * Returns:
 * Password update success response
 */
export const resetPasswordController =
  async (
    req: Request,
    res: Response
  ) => {

    const {
      userId,
      newPassword,
      confirmPassword
    } = req.body;

    await resetPasswordService(
      userId,
      newPassword,
      confirmPassword
    );

    res.status(HTTP_STATUS.OK).json({
      message:
        MESSAGES.PASSWORD_UPDATED
    });

  };