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

  // L.12 — Monthly forms. Normalize to "Mxx YYYY" so the existing
  // (company, quarter) UNIQUE constraint stays satisfied and
  // periodColumnsFromQuarterString() picks up the right (year, month, kind).
  // "Jan 2026" / "January 2026"
  const monthShort = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const monthLong = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  const lower = t.toLowerCase();
  for (let i = 0; i < 12; i++) {
    if (lower.startsWith(monthShort[i]) || lower.startsWith(monthLong[i])) {
      const yMatch = /(\d{4})/.exec(lower);
      if (yMatch) return `M${String(i + 1).padStart(2, "0")} ${yMatch[1]}`;
    }
  }
  // "2026-01" or "2026/01"
  const m4 = /^(\d{4})[-/](\d{1,2})$/.exec(t);
  if (m4) return `M${String(parseInt(m4[2], 10)).padStart(2, "0")} ${m4[1]}`;
  // "01/2026" or "01-2026"
  const m5 = /^(\d{1,2})[-/](\d{4})$/.exec(t);
  if (m5) return `M${String(parseInt(m5[1], 10)).padStart(2, "0")} ${m5[2]}`;
  // Already in our internal monthly form
  if (/^M(\d{2})\s+\d{4}$/i.test(t)) return t.toUpperCase();
  // "FY 2026" / "2026"
  if (/^(?:FY\s*)?\d{4}$/i.test(t)) {
    const y = /\d{4}/.exec(t)![0];
    return `FY ${y}`;
  }
  return null;
}

// Airtable-style wide format: one row per company, columns are
// "<metric> <period>" or "<period> <metric>" pairs.
// We detect this by scanning headers for tokens that contain BOTH a metric
// keyword AND a period token, then unpivot to long format so the rest of the
// pipeline keeps working.
const METRIC_TOKEN_PATTERNS: Array<{ keys: RegExp; canonical: "arr" | "burn" | "cash" | "revenue" | "headcount" }> = [
  { keys: /\b(arr)\b/i, canonical: "arr" },
  { keys: /\b(burn|monthly[_\s-]?burn)\b/i, canonical: "burn" },
  { keys: /\b(cash)\b/i, canonical: "cash" },
  { keys: /\b(revenue|rev)\b/i, canonical: "revenue" },
  { keys: /\b(headcount|fte|employees|team[_\s-]?size)\b/i, canonical: "headcount" },
];

const MONTH_NAMES_RE = /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)/i;

function extractPeriodFromHeader(h: string): string | null {
  // "Jan 2024" / "January 2024" / "Jan-24" / "Jan/24"
  const m1 = MONTH_NAMES_RE.exec(h);
  if (m1) {
    const yMatch = /(20\d{2})/.exec(h) ?? /[-/](\d{2})\b/.exec(h);
    if (yMatch) {
      const y = yMatch[1].length === 2 ? `20${yMatch[1]}` : yMatch[1];
      const norm = normalizeQuarter(`${m1[1]} ${y}`);
      return norm;
    }
  }
  // "2024-01" / "2024/01" / "2024-Q1"
  const m2 = /^(?:.*?\D)?(20\d{2})[-/](\d{1,2}|Q[1-4])(?:\D.*)?$/i.exec(h);
  if (m2) return normalizeQuarter(`${m2[1]}-${m2[2]}`);
  // "Q1 2024"
  const m3 = /Q[1-4]\s*20\d{2}|20\d{2}\s*Q[1-4]/i.exec(h);
  if (m3) return normalizeQuarter(m3[0]);
  return null;
}

function extractMetricFromHeader(h: string): "arr" | "burn" | "cash" | "revenue" | "headcount" | null {
  for (const pat of METRIC_TOKEN_PATTERNS) {
    if (pat.keys.test(h)) return pat.canonical;
  }
  return null;
}

interface WideDetection {
  isWide: boolean;
  // For each wide column: { idx, metric, period }. Other columns are pass-through.
  wideCols: Array<{ idx: number; metric: ReturnType<typeof extractMetricFromHeader>; period: string | null }>;
  passthroughIdx: number[];
}

function detectWide(rawHeaders: string[]): WideDetection {
  const wideCols: WideDetection["wideCols"] = [];
  const passthroughIdx: number[] = [];
  for (let i = 0; i < rawHeaders.length; i++) {
    const h = rawHeaders[i];
    const period = extractPeriodFromHeader(h);
    const metric = extractMetricFromHeader(h);
    if (period && metric) {
      wideCols.push({ idx: i, metric, period });
    } else {
      passthroughIdx.push(i);
    }
  }
  // Heuristic: at least 3 wide columns spanning ≥2 distinct periods is "wide".
  const distinctPeriods = new Set(wideCols.map((c) => c.period));
  const isWide = wideCols.length >= 3 && distinctPeriods.size >= 2;
  return { isWide, wideCols, passthroughIdx };
}

/** Convert a wide-format CSV (Airtable-style) into a long-format CSV that the
 *  existing parser can consume. Returns null if the input doesn't look wide. */
export function unpivotWideMetricsCsv(text: string): string | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return null;
  const rawHeaders = splitCsvLine(lines[0]).map((h) => h.trim());
  const headers = rawHeaders.map(normalizeHeader);

  const det = detectWide(rawHeaders);
  if (!det.isWide) return null;

  const idxCompany = pickColumn(headers, COMPANY_KEYS);
  if (idxCompany < 0) return null;

  // Build long rows. Group wide columns by period, so each (company, period)
  // row carries every metric for that period at once.
  const out: string[] = ["company,quarter,arr_usd,burn_usd,cash_usd,revenue_usd,headcount"];
  for (let r = 1; r < lines.length; r++) {
    const cells = splitCsvLine(lines[r]);
    const company = (cells[idxCompany] ?? "").trim();
    if (!company) continue;

    const byPeriod = new Map<string, { arr?: string; burn?: string; cash?: string; revenue?: string; headcount?: string }>();
    for (const wc of det.wideCols) {
      if (!wc.period || !wc.metric) continue;
      const v = (cells[wc.idx] ?? "").trim();
      if (!v) continue;
      const bucket = byPeriod.get(wc.period) ?? {};
      bucket[wc.metric] = v;
      byPeriod.set(wc.period, bucket);
    }

    for (const [period, vals] of byPeriod) {
      const escape = (s: string) => /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      out.push([
        escape(company),
        escape(period),
        vals.arr ?? "",
        vals.burn ?? "",
        vals.cash ?? "",
        vals.revenue ?? "",
        vals.headcount ?? "",
      ].join(","));
    }
  }
  return out.length > 1 ? out.join("\n") : null;
}

export function parseMetricsCsv(text: string): ParseResult {
  // L.4c — auto-detect Airtable wide-format and unpivot before parsing.
  const widened = unpivotWideMetricsCsv(text);
  if (widened) text = widened;

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
