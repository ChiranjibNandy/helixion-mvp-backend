import { ORG_ROLE } from "../constants/enum.js";


export const mapSpreadsheetEmployee = (
  row: any,
  org: any,
  defaultPassword: string
) => {
  const officeRoles = {
    trainingDept: {
      enabled: false,
      level: 0,
    },
    osd: {
      enabled: false,
      level: 0,
    },
  };

  if (
    row["Training Department Officer (CTD)"]
      ?.toString()
      .trim()
      .toLowerCase() === "yes"
  ) {
    officeRoles.trainingDept.enabled = true;
    officeRoles.trainingDept.level = 2;
  }

  if (
    row["OSD Officer"]
      ?.toString()
      .trim()
      .toLowerCase() === "yes"
  ) {
    officeRoles.osd.enabled = true;
    officeRoles.osd.level = 2;
  }


  const isManager =
    row["Manager"]?.toString().trim().toLowerCase() === "yes";

  return {
    orgId: org._id,
    orgType: org.orgType,

    employeeCode: row["Employee Roll No."]?.toString().trim(),

    name: row["Name of the employee"]?.toString().trim(),

    email: row.Email?.toString().trim().toLowerCase(),

    mobile: row.Mobile?.toString().trim(),

    placeOfPosting: row["Place of Posting"]?.toString().trim() || "",

    designation: row.Designation?.toString().trim() || "",

    department: row.Department?.toString().trim() || "",

    passwordHash: defaultPassword,

    // Bulk-uploaded employees log in directly with the default password —
    // the frontend has no flow to intercept a forced password-change, so
    // leaving this true would lock every bulk-uploaded user out after login.
    mustChangePassword: false,

    orgRole: isManager ? ORG_ROLE.MANAGER : ORG_ROLE.EMPLOYEE,

    officeRoles,
  };
};