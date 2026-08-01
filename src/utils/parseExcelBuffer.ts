import * as XLSX from "xlsx";

export const parseExcelBuffer = async (buffer: Buffer) => {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
  });

  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  return XLSX.utils.sheet_to_json(sheet, {
    defval: "",
  });
};