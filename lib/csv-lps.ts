// CSV parser for the LP bulk import. Mirrors lib/csv-metrics.ts but with
// LP-shaped columns. Excel workbooks reuse the existing xlsx-metrics adapter
// (sheet → CSV string).

export interface ParsedLpRow {
  name: string;
  type: string; // we resolve to enum in the server action
  commitmentUsd: number | null;
  country: string | null;
  email: string | null;
  lineNumber: number;
}

export interface LpParseResult {
  rows: ParsedLpRow[];
  errors: string[];
  recognizedHeaders: string[];
  ignoredHeaders: string[];
}

const NAME_KEYS = ["name", "lp", "lp_name", "investor", "investor_name"];
const TYPE_KEYS = ["type", "lp_type", "category"];
const COMMIT_KEYS = ["commitment", "commitment_usd", "amount", "size"];
const COUNTRY_KEYS = ["country", "geo"];
const EMAIL_KEYS = ["email", "contact_email", "contact"];

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s\-]+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function pickColumn(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const i = headers.indexOf(c);
    if (i >= 0) return i;
  }
  return -1;
}

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

function parseAmount(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  // Tolerate $, commas, spaces, "MM" / "M" / "K" suffixes.
  let cleaned = t.replace(/[$,\s]/g, "");
  let multiplier = 1;
  if (/MM?$/i.test(cleaned)) { multiplier = 1_000_000; cleaned = cleaned.replace(/MM?$/i, ""); }
  else if (/K$/i.test(cleaned)) { multiplier = 1_000; cleaned = cleaned.replace(/K$/i, ""); }
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * multiplier);
}

export function parseLpsCsv(text: string): LpParseResult {
  const errors: string[] = [];
  const rows: ParsedLpRow[] = [];

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { rows, errors: ["CSV needs a header row and at least one data row"], recognizedHeaders: [], ignoredHeaders: [] };
  }

  const rawHeaders = splitCsvLine(lines[0]).map((h) => h.trim());
  const headers = rawHeaders.map(normalizeHeader);

  const idxName = pickColumn(headers, NAME_KEYS);
  const idxType = pickColumn(headers, TYPE_KEYS);
  const idxCommit = pickColumn(headers, COMMIT_KEYS);
  const idxCountry = pickColumn(headers, COUNTRY_KEYS);
  const idxEmail = pickColumn(headers, EMAIL_KEYS);

  const recognized: string[] = [];
  const ignored: string[] = [];
  for (let i = 0; i < headers.length; i++) {
    if ([idxName, idxType, idxCommit, idxCountry, idxEmail].includes(i)) recognized.push(rawHeaders[i]);
    else ignored.push(rawHeaders[i]);
  }

  if (idxName < 0) errors.push(`Missing name column. Expected one of: ${NAME_KEYS.join(", ")}`);
  if (errors.length > 0) {
    return { rows, errors, recognizedHeaders: recognized, ignoredHeaders: ignored };
  }

  for (let r = 1; r < lines.length; r++) {
    const lineNumber = r + 1;
    const cells = splitCsvLine(lines[r]);
    const name = (cells[idxName] ?? "").trim();
    if (!name) continue; // tolerate blank/sparse rows

    const typeRaw = idxType >= 0 ? (cells[idxType] ?? "").trim() : "";
    const commit = idxCommit >= 0 ? parseAmount(cells[idxCommit] ?? "") : null;
    const country = idxCountry >= 0 ? ((cells[idxCountry] ?? "").trim().toUpperCase() || null) : null;
    const email = idxEmail >= 0 ? ((cells[idxEmail] ?? "").trim().toLowerCase() || null) : null;

    rows.push({
      name,
      type: typeRaw || "Institutional",
      commitmentUsd: commit,
      country,
      email,
      lineNumber,
    });
  }

  return { rows, errors, recognizedHeaders: recognized, ignoredHeaders: ignored };
}
