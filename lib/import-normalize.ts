// L.8e — Apply an AI-produced mapping to the actual sheet data.
// Lives client-side so the user can preview before sending anything to the
// server. Pure functions — no Supabase access.

import type { ParsedSheet } from "./xlsx-multi-sheet";
import type { CompanyDraft } from "@/app/onboarding/actions";

export interface ColumnMapping {
  source: string;
  note?: string;
}

export interface SheetMapping {
  sheetName: string;
  shape: "companies_long" | "companies_simple" | "metrics_only" | "ignored";
  companyNameOverride?: string | null;
  columns: Partial<{
    company_name: ColumnMapping;
    period: ColumnMapping;
    sector: ColumnMapping;
    country: ColumnMapping;
    stage: ColumnMapping;
    invested: ColumnMapping;
    ownership_pct: ColumnMapping;
    founder: ColumnMapping;
    founder_email: ColumnMapping;
    arr: ColumnMapping;
    burn: ColumnMapping;
    cash: ColumnMapping;
    revenue: ColumnMapping;
    headcount: ColumnMapping;
    runway: ColumnMapping;
  }>;
  notes?: string;
}

export interface NormalizedMetric {
  companyName: string;
  period: string;        // raw, will be canonicalized later by lib/csv-metrics
  arr: number | null;
  burn: number | null;
  cash: number | null;
  revenue: number | null;
  headcount: number | null;
}

export interface NormalizeResult {
  companies: CompanyDraft[];
  /** Metric rows extracted from companies_long + metrics_only sheets. */
  metrics: NormalizedMetric[];
  /** Sheets we ignored, with reasons (for UI display). */
  skipped: Array<{ sheetName: string; reason: string }>;
}

// Tiny CSV splitter — same behavior as lib/csv-metrics' splitCsvLine.
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQ = false; }
      else cur += ch;
    } else {
      if (ch === '"' && cur === "") inQ = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseNumber(raw: string | undefined): number | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t) return null;
  const cleaned = t.replace(/[$,\s]/g, "").replace(/%$/, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function findColumnIdx(headers: string[], target: string | undefined): number {
  if (!target) return -1;
  const t = target.trim().toLowerCase();
  return headers.findIndex((h) => h.trim().toLowerCase() === t);
}

function pickStage(raw: string | undefined): CompanyDraft["stage"] {
  const t = (raw ?? "").trim().toLowerCase();
  if (t.includes("pre")) return "Pre-seed";
  if (t.includes("series a") || t === "a") return "Series A";
  if (t.includes("series b") || t === "b") return "Series B";
  return "Seed";
}

function normalizeCountry(raw: string | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  if (/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase();
  const map: Record<string, string> = {
    mexico: "MX", brazil: "BR", brasil: "BR", colombia: "CO", chile: "CL",
    argentina: "AR", peru: "PE", uruguay: "UY", ecuador: "EC", panama: "PA",
    "united states": "US", usa: "US",
  };
  return map[t.toLowerCase()] ?? t.slice(0, 2).toUpperCase();
}

export function applyMappings(sheets: ParsedSheet[], mappings: SheetMapping[]): NormalizeResult {
  const sheetByName = new Map<string, ParsedSheet>();
  for (const s of sheets) sheetByName.set(s.name, s);

  const companiesByKey = new Map<string, CompanyDraft>();   // dedupe by lowercased name
  const metrics: NormalizedMetric[] = [];
  const skipped: Array<{ sheetName: string; reason: string }> = [];

  for (const m of mappings) {
    const sheet = sheetByName.get(m.sheetName);
    if (!sheet) {
      skipped.push({ sheetName: m.sheetName, reason: "sheet missing in file" });
      continue;
    }
    if (m.shape === "ignored") {
      skipped.push({ sheetName: m.sheetName, reason: m.notes ?? "ignored" });
      continue;
    }

    const lines = sheet.csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      skipped.push({ sheetName: m.sheetName, reason: "no data rows" });
      continue;
    }
    const headers = splitCsvLine(lines[0]);

    // Resolve column indexes once per sheet.
    const idx = {
      name: findColumnIdx(headers, m.columns.company_name?.source),
      period: findColumnIdx(headers, m.columns.period?.source),
      sector: findColumnIdx(headers, m.columns.sector?.source),
      country: findColumnIdx(headers, m.columns.country?.source),
      stage: findColumnIdx(headers, m.columns.stage?.source),
      invested: findColumnIdx(headers, m.columns.invested?.source),
      ownership: findColumnIdx(headers, m.columns.ownership_pct?.source),
      founder: findColumnIdx(headers, m.columns.founder?.source),
      founderEmail: findColumnIdx(headers, m.columns.founder_email?.source),
      arr: findColumnIdx(headers, m.columns.arr?.source),
      burn: findColumnIdx(headers, m.columns.burn?.source),
      cash: findColumnIdx(headers, m.columns.cash?.source),
      revenue: findColumnIdx(headers, m.columns.revenue?.source),
      headcount: findColumnIdx(headers, m.columns.headcount?.source),
    };

    for (let r = 1; r < lines.length; r++) {
      const row = splitCsvLine(lines[r]);
      const get = (i: number) => (i >= 0 ? row[i]?.trim() ?? "" : "");

      // Resolve company name. metrics_only uses the sheet name override.
      let companyName = m.shape === "metrics_only"
        ? (m.companyNameOverride ?? sheet.name)
        : get(idx.name);
      companyName = companyName.trim();
      if (!companyName) continue;

      // Upsert the company entry (first occurrence wins for profile fields).
      const key = companyName.toLowerCase();
      if (!companiesByKey.has(key)) {
        companiesByKey.set(key, {
          name: companyName,
          sector: idx.sector >= 0 ? get(idx.sector) || null : null,
          country: idx.country >= 0 ? normalizeCountry(get(idx.country)) : null,
          stage: idx.stage >= 0 ? pickStage(get(idx.stage)) : "Seed",
          status: "no_data",
          investedUsd: idx.invested >= 0 ? parseNumber(get(idx.invested)) ?? 0 : 0,
          ownershipPct: idx.ownership >= 0 ? parseNumber(get(idx.ownership)) ?? 0 : 0,
          founderName: idx.founder >= 0 ? get(idx.founder) || null : null,
          founderEmail: idx.founderEmail >= 0 ? get(idx.founderEmail) || null : null,
        });
      }

      // Extract metric row when this sheet is companies_long or metrics_only.
      if (m.shape === "companies_long" || m.shape === "metrics_only") {
        const period = idx.period >= 0 ? get(idx.period) : "";
        if (!period) continue;
        const mr: NormalizedMetric = {
          companyName,
          period,
          arr: idx.arr >= 0 ? parseNumber(get(idx.arr)) : null,
          burn: idx.burn >= 0 ? parseNumber(get(idx.burn)) : null,
          cash: idx.cash >= 0 ? parseNumber(get(idx.cash)) : null,
          revenue: idx.revenue >= 0 ? parseNumber(get(idx.revenue)) : null,
          headcount: idx.headcount >= 0 ? parseNumber(get(idx.headcount)) : null,
        };
        // Skip if every metric is null (just a header echo or empty row).
        if (mr.arr == null && mr.burn == null && mr.cash == null && mr.revenue == null && mr.headcount == null) {
          continue;
        }
        metrics.push(mr);
      }
    }
  }

  return {
    companies: Array.from(companiesByKey.values()),
    metrics,
    skipped,
  };
}
