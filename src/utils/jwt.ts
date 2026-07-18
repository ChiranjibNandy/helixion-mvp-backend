import jwt from "jsonwebtoken";
import { ENV } from "../config/env.js";
import { IPermission } from "../types/auth.js";

export interface JwtPayloadType {
   userId: string;
   name: string;
   email: string;

   /** MongoDB _id of the user's organisation (undefined for training providers) */
   orgId?: string;

   /** Top-level org role: admin | employee | training_provider */
   orgRole?: string;

   /** Office role flags — embedded to avoid DB round trip on every request */
   officeRoles?: {
      trainingDept: { enabled: boolean; level: number | null };
      osd: { enabled: boolean; level: number | null };
   };

   /**
    * User's own rank in the reporting hierarchy: 0 = individual contributor,
    * 1+ = manages at least one direct report. There is no distinct `orgRole`
    * for "manager" — a manager is an `orgRole: employee` with this level > 0
    * — so this is the only signal available to tell them apart client-side.
    */
   hierarchyLevel?: number;

   /** If true the user must change their password before accessing the app */
   mustChangePassword?: boolean;
   permissions:IPermission
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
