import { Request, Response, NextFunction } from "express";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { ORG_ROLE } from "../constants/enum.js";

// ─────────────────────────────────────────────────────────────────────────────
// authenticate
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Verifies the JWT (cookie or Authorization header) and attaches decoded
 * claims to req: userId, orgId, orgRole, officeRoles, mustChangePassword.
 *
 * Must be applied BEFORE any of the authorize* middlewares.
 */
export const authenticate = (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   try {
      const token =
         req.cookies?.accessToken ||
         req.headers.authorization?.split(" ")[1];

      if (!token) {
         return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            message: MESSAGES.TOKEN_REQUIRED,
         });
      }

      const decoded = verifyAccessToken(token);

      req.userId            = decoded.userId;
      req.orgId             = decoded.orgId;
      req.orgRole           = decoded.orgRole;
      req.officeRoles       = decoded.officeRoles;
      req.mustChangePassword = decoded.mustChangePassword;

      return next();
   } catch (error: any) {
      console.error("Token verification failed:", error.message);
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
         success: false,
         message: MESSAGES.INVALID_OR_EXPIRED_TOKEN,
      });
   }
};

// ─────────────────────────────────────────────────────────────────────────────
// authorizeRole
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Guards a route to only the listed org-level roles.
 * Supports multiple roles: authorizeRole("admin", "employee")
 *
 * Must be called AFTER authenticate.
 */
export const authorizeRole = (...allowedRoles: ORG_ROLE[]) => {
   return (req: Request, res: Response, next: NextFunction) => {
      const role = req.orgRole;

      if (!role || !allowedRoles.includes(role as ORG_ROLE)) {
         return res.status(HTTP_STATUS.FORBIDDEN).json({
            success: false,
            message: MESSAGES.ACCESS_DENIED,
         });
      }

      return next();
   };
};

// ─────────────────────────────────────────────────────────────────────────────
// authorizeOfficeRole
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Guards a route to users who hold an office role (Training Dept / OSD)
 * at or above the specified minimum level.
 *
 * @param type       - "trainingDept" | "osd"
 * @param minLevel   - 1 (junior) | 2 (senior)
 *
 * Must be called AFTER authenticate.
 *
 * Example:
 *   router.patch("/approve", authenticate, authorizeOfficeRole("osd", 2), handler)
 */
export const authorizeOfficeRole = (
   type: "trainingDept" | "osd",
   minLevel: 1 | 2
) => {
   return (req: Request, res: Response, next: NextFunction) => {
      const officerInfo = req.officeRoles?.[type];

      if (!officerInfo?.enabled || officerInfo.level == null || officerInfo.level < minLevel) {
         return res.status(HTTP_STATUS.FORBIDDEN).json({
            success: false,
            message: MESSAGES.ACCESS_DENIED,
         });
      }

      return next();
   };
};

// ─────────────────────────────────────────────────────────────────────────────
// requirePasswordChange
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Blocks access to any protected route if mustChangePassword is true.
 * The frontend uses this 403 response to redirect to the change-password screen.
 *
 * Apply AFTER authenticate, before route-specific guards:
 *   router.use(authenticate, requirePasswordChange, authorizeRole(...))
 */
export const requirePasswordChange = (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   if (req.mustChangePassword) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
         success: false,
         code:    "PASSWORD_CHANGE_REQUIRED",
         message: "You must change your password before accessing this resource.",
      });
   }

   return next();
};