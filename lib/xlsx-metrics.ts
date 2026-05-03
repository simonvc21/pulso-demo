// Convert an .xlsx file to the same CSV string shape parseMetricsCsv expects.
// Keeps the parser as the single source of truth for header tolerance, quarter
// normalization, and number cleanup — xlsx just becomes a pre-processor.
//
// Security note: xlsx@0.18.5 has known CVEs around prototype pollution and
// ReDoS in formula parsing. Mitigations here:
// - We pass cellFormula:false so the formula parser never runs.
// - The parsed rows go through parseMetricsCsv which strictly validates every
//   column and only writes to typed BigInts via Supabase.
// - We never eval / dangerouslySet / template-string parsed content.

import { read as xlsxRead, utils as xlsxUtils, type WorkBook } from "xlsx";

export interface XlsxParseResult {
  csv: string;
  sheetName: string;
  totalSheets: number;
}

export function xlsxFileToCsv(buffer: ArrayBuffer): XlsxParseResult {
  const wb: WorkBook = xlsxRead(buffer, {
    type: "array",
    cellFormula: false,    // disable formula evaluation
    cellHTML: false,       // skip HTML conversion
    cellText: false,
    raw: true,             // get raw values, format ourselves
  });

  if (wb.SheetNames.length === 0) {
    throw new Error("Workbook has no sheets");
  }

  // Pick the first sheet that has at least 2 rows (header + 1 data). Falls
  // back to the first sheet if none qualify (so the user sees an error from
  // parseMetricsCsv rather than a silent skip).
  let pickedName = wb.SheetNames[0];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const ref = ws["!ref"];
    if (!ref) continue;
    const range = xlsxUtils.decode_range(ref);
    if (range.e.r - range.s.r >= 1) {
      pickedName = name;
      break;
    }
  }

  const ws = wb.Sheets[pickedName];
  // sheet_to_csv handles quoting, escaping, and newlines for us. Pass FS=","
  // explicitly even though that's the default — making it grep-able if we
  // ever want to switch.
  const csv = xlsxUtils.sheet_to_csv(ws, {
    FS: ",",
    blankrows: false,
    rawNumbers: true,
  });

  return { csv, sheetName: pickedName, totalSheets: wb.SheetNames.length };
}
