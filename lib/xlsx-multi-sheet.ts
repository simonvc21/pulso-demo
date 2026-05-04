// L.8e — Multi-sheet xlsx parser. The existing xlsxFileToCsv only returns the
// first sheet. Real fund exports (Airtable, custom workbooks) often split data
// across one sheet per company or one sheet per period — we need all of them.

import { read as xlsxRead, utils as xlsxUtils, type WorkBook } from "xlsx";

export interface ParsedSheet {
  name: string;
  csv: string;
  rowCount: number;       // data rows (excludes header)
  headers: string[];      // first row as a friendly array
}

export interface MultiSheetResult {
  sheets: ParsedSheet[];
  /** First sheet that actually contained data; convenience for the legacy
   *  single-sheet flow. */
  primary: ParsedSheet | null;
}

export function xlsxFileToAllSheets(buffer: ArrayBuffer): MultiSheetResult {
  const wb: WorkBook = xlsxRead(buffer, {
    type: "array",
    cellFormula: false,
    cellHTML: false,
    cellText: false,
    raw: true,
  });

  if (wb.SheetNames.length === 0) {
    return { sheets: [], primary: null };
  }

  const sheets: ParsedSheet[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const ref = ws["!ref"];
    if (!ref) {
      sheets.push({ name, csv: "", rowCount: 0, headers: [] });
      continue;
    }
    const range = xlsxUtils.decode_range(ref);
    const dataRowCount = Math.max(0, range.e.r - range.s.r); // header + N data → N
    const csv = xlsxUtils.sheet_to_csv(ws, {
      FS: ",",
      blankrows: false,
      rawNumbers: true,
    });
    const firstLine = csv.split(/\r?\n/)[0] ?? "";
    const headers = firstLine.split(",").map((h) => h.trim());
    sheets.push({ name, csv, rowCount: dataRowCount, headers });
  }

  const primary = sheets.find((s) => s.rowCount > 0) ?? sheets[0] ?? null;
  return { sheets, primary };
}

/** Truncate a CSV to its first N data rows (keeps header). For sending samples
 *  to an LLM without blowing token limits. */
export function csvSample(csv: string, maxRows = 8): string {
  const lines = csv.split(/\r?\n/);
  if (lines.length <= maxRows + 1) return csv;
  return lines.slice(0, maxRows + 1).join("\n");
}
