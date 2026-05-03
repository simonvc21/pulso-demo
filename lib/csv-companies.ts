// Client-safe parser for the onboarding companies CSV/Excel import.
// Long format: one row per company. Headers are normalized so users can paste
// a typical Airtable export ("Company Name", "Stage", "Country", "Invested ($)",
// "Ownership %", "Founder", "Founder Email", "Sector").

import type { CompanyDraft } from "@/app/onboarding/actions";

export interface ParsedCompanyRow extends CompanyDraft {
  lineNumber: number;
}

export interface ParseCompaniesResult {
  rows: ParsedCompanyRow[];
  errors: string[];
  recognizedHeaders: string[];
  ignoredHeaders: string[];
}

const NAME_KEYS = ["name", "company", "company_name"];
const SECTOR_KEYS = ["sector", "industry", "vertical", "category"];
const COUNTRY_KEYS = ["country", "country_code", "geo"];
const STAGE_KEYS = ["stage", "round", "round_stage"];
const STATUS_KEYS = ["status", "health"];
const INVESTED_KEYS = ["invested", "invested_usd", "investment", "amount", "check_size"];
const OWNERSHIP_KEYS = ["ownership", "ownership_pct", "ownership_percent", "equity_pct"];
const FOUNDER_KEYS = ["founder", "founder_name", "ceo", "ceo_name"];
const FOUNDER_EMAIL_KEYS = ["founder_email", "ceo_email", "email", "contact_email"];

const VALID_STAGES = ["Pre-seed", "Seed", "Series A", "Series B"] as const;
const VALID_STATUSES = ["healthy", "watch", "critical", "no_data"] as const;

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

function parseNumber(raw: string): number {
  const t = raw.trim();
  if (!t) return 0;
  const cleaned = t.replace(/[$,\s]/g, "").replace(/%$/, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function normalizeStage(raw: string): typeof VALID_STAGES[number] {
  const t = raw.trim().toLowerCase();
  if (t.includes("pre")) return "Pre-seed";
  if (t.includes("series a") || t === "a") return "Series A";
  if (t.includes("series b") || t === "b") return "Series B";
  return "Seed";
}

function normalizeStatus(raw: string): typeof VALID_STATUSES[number] {
  const t = raw.trim().toLowerCase();
  if (t.includes("crit") || t.includes("red")) return "critical";
  if (t.includes("watch") || t.includes("yellow") || t.includes("amber")) return "watch";
  if (t.includes("health") || t.includes("green") || t.includes("ok")) return "healthy";
  return "no_data";
}

function normalizeCountry(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  // ISO-2 already
  if (/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase();
  // Common LATAM full names
  const map: Record<string, string> = {
    mexico: "MX", brazil: "BR", brasil: "BR", colombia: "CO", chile: "CL",
    argentina: "AR", peru: "PE", uruguay: "UY", ecuador: "EC", panama: "PA",
    "united states": "US", usa: "US",
  };
  return map[t.toLowerCase()] ?? t.slice(0, 2).toUpperCase();
}

export function parseCompaniesCsv(text: string): ParseCompaniesResult {
  const errors: string[] = [];
  const rows: ParsedCompanyRow[] = [];

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return {
      rows, errors: ["CSV needs a header row and at least one data row"],
      recognizedHeaders: [], ignoredHeaders: [],
    };
  }

  const rawHeaders = splitCsvLine(lines[0]).map((h) => h.trim());
  const headers = rawHeaders.map(normalizeHeader);

  const idxName = pickColumn(headers, NAME_KEYS);
  const idxSector = pickColumn(headers, SECTOR_KEYS);
  const idxCountry = pickColumn(headers, COUNTRY_KEYS);
  const idxStage = pickColumn(headers, STAGE_KEYS);
  const idxStatus = pickColumn(headers, STATUS_KEYS);
  const idxInvested = pickColumn(headers, INVESTED_KEYS);
  const idxOwnership = pickColumn(headers, OWNERSHIP_KEYS);
  const idxFounder = pickColumn(headers, FOUNDER_KEYS);
  const idxFounderEmail = pickColumn(headers, FOUNDER_EMAIL_KEYS);

  const recognized: string[] = [];
  const ignored: string[] = [];
  const usedIdx = new Set([idxName, idxSector, idxCountry, idxStage, idxStatus,
    idxInvested, idxOwnership, idxFounder, idxFounderEmail].filter((i) => i >= 0));
  for (let i = 0; i < headers.length; i++) {
    if (usedIdx.has(i)) recognized.push(rawHeaders[i]); else ignored.push(rawHeaders[i]);
  }

  if (idxName < 0) {
    errors.push(`Missing company name column. Expected one of: ${NAME_KEYS.join(", ")}`);
    return { rows, errors, recognizedHeaders: recognized, ignoredHeaders: ignored };
  }

  for (let r = 1; r < lines.length; r++) {
    const lineNumber = r + 1;
    const cells = splitCsvLine(lines[r]);
    const name = (cells[idxName] ?? "").trim();
    if (!name) continue;

    rows.push({
      name,
      sector: idxSector >= 0 ? (cells[idxSector] ?? "").trim() || null : null,
      country: idxCountry >= 0 ? normalizeCountry(cells[idxCountry] ?? "") : null,
      stage: idxStage >= 0 ? normalizeStage(cells[idxStage] ?? "") : "Seed",
      status: idxStatus >= 0 ? normalizeStatus(cells[idxStatus] ?? "") : "no_data",
      investedUsd: idxInvested >= 0 ? parseNumber(cells[idxInvested] ?? "") : 0,
      ownershipPct: idxOwnership >= 0 ? parseNumber(cells[idxOwnership] ?? "") : 0,
      founderName: idxFounder >= 0 ? (cells[idxFounder] ?? "").trim() || null : null,
      founderEmail: idxFounderEmail >= 0 ? (cells[idxFounderEmail] ?? "").trim() || null : null,
      lineNumber,
    });
  }

  return { rows, errors, recognizedHeaders: recognized, ignoredHeaders: ignored };
}
