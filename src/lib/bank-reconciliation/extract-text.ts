/**
 * Bank statement file → CSV-like text extractor.
 *
 * Supports:
 *   - CSV / plain text (passed through)
 *   - XLSX (Excel — via exceljs, joined as comma-separated text)
 *   - PDF (via pdf-parse, line-broken text — works best with text-based PDFs;
 *     image-based scans yield empty text and should be rejected upstream)
 */

import ExcelJS from "exceljs";

export type StatementKind = "csv" | "xlsx" | "xls" | "pdf";

export function detectKind(filename: string, mimeType: string | null): StatementKind {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".xlsx") || mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    return "xlsx";
  }
  if (lower.endsWith(".xls") || mimeType === "application/vnd.ms-excel") {
    return "xls";
  }
  if (lower.endsWith(".pdf") || mimeType === "application/pdf") {
    return "pdf";
  }
  return "csv";
}

async function xlsxToCsv(buffer: ArrayBuffer): Promise<string> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return "";

  const lines: string[] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      let v: unknown = cell.value;
      // Unwrap rich/formula/hyperlink cell objects to their plain value.
      if (v && typeof v === "object") {
        if ("result" in v && v.result !== undefined) v = (v as { result: unknown }).result;
        else if ("text" in v && (v as { text?: unknown }).text !== undefined) v = (v as { text: unknown }).text;
        else if ("richText" in v && Array.isArray((v as { richText?: unknown }).richText)) {
          v = ((v as { richText: { text: string }[] }).richText).map((r) => r.text).join("");
        } else if (v instanceof Date) {
          v = v.toISOString().slice(0, 10);
        }
      }
      const s = v === null || v === undefined ? "" : String(v);
      cells.push(/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    });
    lines.push(cells.join(","));
  });
  return lines.join("\n");
}

async function xlsBinaryToCsv(buffer: ArrayBuffer): Promise<string> {
  // SheetJS handles legacy .xls (BIFF) which ExcelJS cannot read.
  // Dynamic import keeps the dep out of unrelated cold-starts.
  const XLSX = await import("xlsx");
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return "";
  const ws = wb.Sheets[sheetName];
  return XLSX.utils.sheet_to_csv(ws);
}

async function pdfToText(buffer: Buffer): Promise<string> {
  // pdf-parse v2 exposes a class-based API. Dynamic import keeps the heavy
  // pdfjs-dist dependency out of the cold-start path for other routes.
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text || "";
  } finally {
    await parser.destroy().catch(() => {});
  }
}

export async function extractStatementText(
  file: File
): Promise<{ kind: StatementKind; text: string }> {
  const kind = detectKind(file.name, file.type || null);
  if (kind === "csv") {
    return { kind, text: await file.text() };
  }
  if (kind === "xlsx") {
    const buf = await file.arrayBuffer();
    return { kind, text: await xlsxToCsv(buf) };
  }
  if (kind === "xls") {
    const buf = await file.arrayBuffer();
    return { kind, text: await xlsBinaryToCsv(buf) };
  }
  if (kind === "pdf") {
    const buf = Buffer.from(await file.arrayBuffer());
    return { kind, text: await pdfToText(buf) };
  }
  throw new Error(`Unsupported statement format: ${kind}`);
}
