import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { ROLE } from "../constants/role.js";

interface JwtPayload {
   userId: string;
   email: string;
   role: string;
}

export const adminAuthMiddleware = (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      //  Get token from header
      const authHeader = req.headers.authorization;

      if (!authHeader) {
         return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            message: MESSAGES.TOKEN_REQUIRED,
         });
      }

      //  Extract token (Bearer token)
      const token = authHeader.split(" ")[1];

      if (!token) {
         return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            message: MESSAGES.INVALID_TOKEN,
         });
      }

      //  Verify token
      const decoded = jwt.verify(
         token,
         process.env.JWT_ACCESS_SECRET as string
      ) as JwtPayload;

      //  Check role
      if (decoded.role !== ROLE.ADMIN) {
         return res.status(HTTP_STATUS.FORBIDDEN).json({
            message: MESSAGES.ADMIN_ACCESS_REQUIRED,
         });
      }

      next();

   } catch (error) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
         message: MESSAGES.INVALID_OR_EXPIRED_TOKEN,
      });
   }
};