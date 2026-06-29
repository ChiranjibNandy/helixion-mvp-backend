import "express";

declare global {
   namespace Express {
      interface Request {
         /** MongoDB _id of the authenticated user */
         userId?: string;
         /** MongoDB _id of the user's organisation (tenant wall) */
         orgId?: string;
         /** Top-level organisational role: admin | employee | training_provider */
         orgRole?: string;
         /** Office roles — flags for training dept / OSD officer duties */
         officeRoles?: {
            trainingDept: { enabled: boolean; level: number | null };
            osd: { enabled: boolean; level: number | null };
         };
         /** If true the user must change their password before accessing protected routes */
         mustChangePassword?: boolean;
      }
   }
}

export { };