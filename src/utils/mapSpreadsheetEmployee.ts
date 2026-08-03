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
    row["Training Department Junior Officer"]
      ?.toString()
      .trim()
      .toLowerCase() === "yes"
  ) {
    officeRoles.trainingDept.enabled = true;
    officeRoles.trainingDept.level = 1;
  }

  if (
    row["Training Department Senior Officer"]
      ?.toString()
      .trim()
      .toLowerCase() === "yes"
  ) {
    officeRoles.trainingDept.enabled = true;
    officeRoles.trainingDept.level = 2;
  }

  if (
    row["OSD Team Junior Officer"]
      ?.toString()
      .trim()
      .toLowerCase() === "yes"
  ) {
    officeRoles.osd.enabled = true;
    officeRoles.osd.level = 1;
  }

  if (
    row["OSD Team Senior Officer"]
      ?.toString()
      .trim()
      .toLowerCase() === "yes"
  ) {
    officeRoles.osd.enabled = true;
    officeRoles.osd.level = 2;
  }

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

    mustChangePassword: true,

    orgRole: ORG_ROLE.EMPLOYEE,

    officeRoles,
  };
};