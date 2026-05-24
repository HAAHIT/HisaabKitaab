import ExcelJS from "exceljs";

export const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function applyMoneyFormat(cell: ExcelJS.Cell) {
  cell.numFmt = '#,##0.00;[Red]-#,##0.00';
}

export function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.alignment = { vertical: "middle" };
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF3F4F6" },
    };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
    };
  });
}

export function styleTotalRow(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.eachCell((cell) => {
    cell.border = {
      top: { style: "medium", color: { argb: "FF374151" } },
    };
  });
}

export async function workbookToBuffer(wb: ExcelJS.Workbook): Promise<ArrayBuffer> {
  const result = await wb.xlsx.writeBuffer();
  // exceljs returns a Node Buffer on Node and an ArrayBuffer in the browser; copy
  // into a standalone ArrayBuffer so the type matches NextResponse's BodyInit.
  if (result instanceof ArrayBuffer) return result;
  const buf = result as Buffer;
  const ab = new ArrayBuffer(buf.byteLength);
  new Uint8Array(ab).set(buf);
  return ab;
}

export function xlsxHeaders(filename: string): Record<string, string> {
  return {
    "Content-Type": XLSX_CONTENT_TYPE,
    "Content-Disposition": `attachment; filename="${filename}"`,
  };
}
