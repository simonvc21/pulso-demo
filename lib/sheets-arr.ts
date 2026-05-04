// L.10 / Fase 1.7 — Convention-based ARR reader for the dashboard.
// Per spec §7: "the dashboard picks the latest row of the sheet named
// 'KPIs trimestrales' of each company and the column named 'ARR'. If it
// doesn't exist → null."
//
// This is the smallest possible bridge between the new sheets model and the
// dashboard ARR-by-company bar chart. Other dashboard charts still read from
// the legacy `metrics` table — full migration is tracked separately.

import { createClient } from "@/lib/supabase/server";

const SHEET_NAME = "KPIs trimestrales";
const COLUMN_NAME = "ARR";

/** Returns a map of company.id → latest ARR value (USD), or null when the
 *  company has no matching sheet/column/row. RLS scopes to the caller's org. */
export async function getLatestArrFromSheets(): Promise<Map<string, number | null>> {
  const supabase = createClient();
  const out = new Map<string, number | null>();

  // Pull every sheet named "KPIs trimestrales" in the caller's org. We then
  // resolve the ARR column id and the latest row in code so we can do this in
  // a constant number of round-trips (3) regardless of company count.
  const { data: sheets } = await supabase
    .from("sheets")
    .select("id, company_id")
    .eq("name", SHEET_NAME);
  if (!sheets || sheets.length === 0) return out;

  const sheetIds = sheets.map((s) => s.id);
  const sheetToCompany = new Map(sheets.map((s) => [s.id, s.company_id]));

  const { data: cols } = await supabase
    .from("sheet_columns")
    .select("id, sheet_id")
    .in("sheet_id", sheetIds)
    .eq("name", COLUMN_NAME);
  const sheetToColumn = new Map<string, string>();
  for (const c of cols ?? []) sheetToColumn.set(c.sheet_id, c.id);

  // Latest row per sheet — we order by position desc and let Postgres return
  // many rows; we just keep the first per sheet seen.
  const { data: rows } = await supabase
    .from("sheet_rows")
    .select("sheet_id, data, position")
    .in("sheet_id", sheetIds)
    .order("position", { ascending: false });

  const latestRowBySheet = new Map<string, any>();
  for (const r of rows ?? []) {
    if (!latestRowBySheet.has(r.sheet_id)) latestRowBySheet.set(r.sheet_id, r);
  }

  for (const sheetId of sheetIds) {
    const companyId = sheetToCompany.get(sheetId);
    const colId = sheetToColumn.get(sheetId);
    const latest = latestRowBySheet.get(sheetId);
    if (!companyId) continue;
    if (!colId || !latest) {
      out.set(companyId, null);
      continue;
    }
    const raw = (latest.data ?? {})[colId];
    const n = Number(raw);
    out.set(companyId, Number.isFinite(n) ? n : null);
  }
  return out;
}
