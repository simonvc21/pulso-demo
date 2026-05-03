// Client-safe CSV parser for the historical metrics import.
//
// Accepts a permissive header set so users can edit the export from
// /api/export/metrics and re-upload it, or paste a hand-rolled CSV. We never
// hit the network from this module — the parsed rows go to a server action
// for validation + persistence.

export interface ParsedMetricRow {
  // The user wrote either a slug or a name; the server resolves it to a real
  // company_id, scoped to the caller's org via RLS.
  companyKey: string;
  quarter: string;
  arrUsd: number | null;
  burnUsd: number | null;
  cashUsd: number | null;
  revenueUsd: number | null;
  headcount: number | null;
  // 1-indexed source line for error reporting.
  lineNumber: number;
}

export interface ParseResult {
  rows: ParsedMetricRow[];
  errors: string[];
  // Headers we recognized, in source order.
  recognizedHeaders: string[];
  // Headers in the file we ignored.
  ignoredHeaders: string[];
}

const COMPANY_KEYS = ["company_slug", "company", "company_name", "slug", "name"];
const QUARTER_KEYS = ["quarter", "period", "q"];
const ARR_KEYS = ["arr_usd", "arr"];
const BURN_KEYS = ["burn_usd", "burn", "monthly_burn"];
const CASH_KEYS = ["cash_usd", "cash"];
const REVENUE_KEYS = ["revenue_usd", "revenue"];
const HEADCOUNT_KEYS = ["headcount", "fte", "employees"];

const QUARTER_RE = /^Q[1-4]\s+\d{4}$/;

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function pickColumn(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const i = headers.indexOf(c);
    if (i >= 0) return i;
  }
  return -1;
}

// Minimal CSV splitter that respects quoted fields and "" escapes. Avoids
// pulling in a dependency for a 7-column spreadsheet.
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = false; }
      } else { cur += ch; }
    } else {
      if (ch === ",") { out.push(cur); cur = ""; }
      else if (ch === '"' && cur === "") { inQuotes = true; }
      else { cur += ch; }
    }
  }
  out.push(cur);
  return out;
}

function parseNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  // Strip $, commas, percent signs. Keep minus sign + decimal point.
  const cleaned = t.replace(/[$,\s]/g, "").replace(/%$/, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return n;
}

function normalizeQuarter(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  // Already canonical: "Q1 2026"
  if (QUARTER_RE.test(t)) return t;
  // "Q1-2026" / "Q1_2026" / "Q1/2026"
  const m1 = /^Q([1-4])[\s\-_/]+(\d{4})$/i.exec(t);
  if (m1) return `Q${m1[1]} ${m1[2]}`;
  // "2026 Q1" or "2026Q1"
  const m2 = /^(\d{4})\s*Q([1-4])$/i.exec(t);
  if (m2) return `Q${m2[2]} ${m2[1]}`;
  // "2026-Q1"
  const m3 = /^(\d{4})-Q([1-4])$/i.exec(t);
  if (m3) return `Q${m3[2]} ${m3[1]}`;
  return null;
}

export function parseMetricsCsv(text: string): ParseResult {
  const errors: string[] = [];
  const rows: ParsedMetricRow[] = [];

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return {
      rows, errors: ["CSV needs a header row and at least one data row"],
      recognizedHeaders: [], ignoredHeaders: [],
    };
  }

  const rawHeaders = splitCsvLine(lines[0]).map((h) => h.trim());
  const headers = rawHeaders.map(normalizeHeader);

  const idxCompany = pickColumn(headers, COMPANY_KEYS);
  const idxQuarter = pickColumn(headers, QUARTER_KEYS);
  const idxArr = pickColumn(headers, ARR_KEYS);
  const idxBurn = pickColumn(headers, BURN_KEYS);
  const idxCash = pickColumn(headers, CASH_KEYS);
  const idxRevenue = pickColumn(headers, REVENUE_KEYS);
  const idxHeadcount = pickColumn(headers, HEADCOUNT_KEYS);

  const recognized: string[] = [];
  const ignored: string[] = [];
  for (let i = 0; i < headers.length; i++) {
    if ([idxCompany, idxQuarter, idxArr, idxBurn, idxCash, idxRevenue, idxHeadcount].includes(i)) {
      recognized.push(rawHeaders[i]);
    } else {
      ignored.push(rawHeaders[i]);
    }
  }

  if (idxCompany < 0) errors.push(`Missing company column. Expected one of: ${COMPANY_KEYS.join(", ")}`);
  if (idxQuarter < 0) errors.push(`Missing quarter column. Expected one of: ${QUARTER_KEYS.join(", ")}`);
  if (errors.length > 0) {
    return { rows, errors, recognizedHeaders: recognized, ignoredHeaders: ignored };
  }

  for (let r = 1; r < lines.length; r++) {
    const lineNumber = r + 1;
    const cells = splitCsvLine(lines[r]);

    const companyRaw = (cells[idxCompany] ?? "").trim();
    const quarterRaw = (cells[idxQuarter] ?? "").trim();
    if (!companyRaw && !quarterRaw) continue; // tolerate blank lines

    if (!companyRaw) { errors.push(`Line ${lineNumber}: missing company`); continue; }

    const quarter = normalizeQuarter(quarterRaw);
    if (!quarter) {
      errors.push(`Line ${lineNumber}: invalid quarter "${quarterRaw}" (expected like "Q1 2026")`);
      continue;
    }

    const arr = idxArr >= 0 ? parseNumber(cells[idxArr] ?? "") : null;
    const burn = idxBurn >= 0 ? parseNumber(cells[idxBurn] ?? "") : null;
    const cash = idxCash >= 0 ? parseNumber(cells[idxCash] ?? "") : null;
    const revenue = idxRevenue >= 0 ? parseNumber(cells[idxRevenue] ?? "") : null;
    const headcount = idxHeadcount >= 0 ? parseNumber(cells[idxHeadcount] ?? "") : null;

    if (arr == null && burn == null && cash == null && revenue == null && headcount == null) {
      errors.push(`Line ${lineNumber}: every metric is empty — nothing to import`);
      continue;
    }

    rows.push({
      companyKey: companyRaw,
      quarter,
      arrUsd: arr,
      burnUsd: burn,
      cashUsd: cash,
      revenueUsd: revenue,
      headcount: headcount != null ? Math.round(headcount) : null,
      lineNumber,
    });
  }

  return { rows, errors, recognizedHeaders: recognized, ignoredHeaders: ignored };
}
