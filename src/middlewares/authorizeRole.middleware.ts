import { Request, Response, NextFunction } from "express";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { verifyAccessToken } from "../utils/jwt.js";

export const authorizeRole = (requiredRole: string) => {
  return (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      let token = req.cookies?.accessToken || req.headers.authorization?.split(" ")[1];


      if (!token) {
        return res.status(
          HTTP_STATUS.UNAUTHORIZED
        ).json({
          message: MESSAGES.TOKEN_REQUIRED,
        });
      }

      // Verify token
      const decoded: any =
        verifyAccessToken(token);

      // Check role
  
      if (decoded.role !== requiredRole) {


        return res.status(
          HTTP_STATUS.FORBIDDEN
        ).json({
          message: MESSAGES.ACCESS_DENIED,
        });
      }

      // Attach user info
      req.userId = decoded.userId;

      next();

    } catch (error: any) {
      console.error(
        "Token verification failed:",
        error.message
      );

      return res.status(
        HTTP_STATUS.UNAUTHORIZED
      ).json({
        message:
          MESSAGES.INVALID_OR_EXPIRED_TOKEN,
      });
    }
  };
};