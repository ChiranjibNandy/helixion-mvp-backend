import { Request, Response, NextFunction } from "express";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { verifyAccessToken } from "../utils/jwt.js";

// Middleware factory to authorize requests based on user role
export const authorizeRole = (requiredRole: string) => {
   return (
      req: Request,
      res: Response,
      next: NextFunction
   ) => {
      try {
         // Get token from Authorization header
         const authHeader =
            req.headers.authorization;

         if (!authHeader) {
            return res.status(
               HTTP_STATUS.UNAUTHORIZED
            ).json({
               message:
                  MESSAGES.TOKEN_REQUIRED,
            });
         }

         // Extract token (Bearer token)
         const token =
            authHeader.split(" ")[1];

         if (!token) {
            return res.status(
               HTTP_STATUS.UNAUTHORIZED
            ).json({
               message:
                  MESSAGES.INVALID_TOKEN,
            });
         }

         // Verify token
         const decoded: any =
            verifyAccessToken(token);

         // Check role authorization
         if (
            decoded.role !==
            requiredRole
         ) {
            return res.status(
               HTTP_STATUS.FORBIDDEN
            ).json({
               message:
                  MESSAGES.ACCESS_DENIED,
            });
         }

         // Attach authenticated userId to request
         req.userId =
            decoded.userId;

         next();

      } catch (error) {
         return res.status(
            HTTP_STATUS.UNAUTHORIZED
         ).json({
            message:
               MESSAGES.INVALID_OR_EXPIRED_TOKEN,
         });
      }
   };
};