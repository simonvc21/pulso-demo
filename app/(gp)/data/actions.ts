"use server";

// L.10/Fase 1.G — only bulkImportMetrics survives here. The /data page is
// gone (sheets per company replaced it) and the cell-edit / per-cell-note
// surface area went with it. The bulk-import action is still wired into the
// onboarding wizard's CSV/xlsx upload step, so we kept it — but its body now
// writes into per-company sheets, not the legacy metrics table.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logUsageEvent } from "@/lib/value-analytics";

// ---------------------------------------------------------------------------
// B.4 — Bulk CSV import of historical metrics
// ---------------------------------------------------------------------------

export type BulkMetricInput = {
  companyKey: string;       // slug or name as written in the CSV
  quarter: string;
  arrUsd: number | null;
  burnUsd: number | null;
  cashUsd: number | null;
  revenueUsd: number | null;
  headcount: number | null;
  lineNumber: number;       // for error reporting
};

export type BulkImportResult =
  | { ok: true; inserted: number; updated: number; skipped: number; errors: string[] }
  | { ok: false; error: string };

export async function bulkImportMetrics(rows: BulkMetricInput[]): Promise<BulkImportResult> {
  // L.10/Fase 1.G — bulk import now writes into per-company sheets. Each
  // BulkMetricInput row becomes (or updates) a row in that company's sheet,
  // keyed by the period label, with canonical ARR / Burn / Cash / Revenue /
  // Headcount columns. Reusing the same convention as submit_public_form so
  // founders + onboarding + CSV import all converge on identical data shape.
  if (!rows || rows.length === 0) return { ok: false, error: "Nothing to import" };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("users")
    .select("id, organization_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!profile?.organization_id) return { ok: false, error: "No fund assigned" };
  const orgId = profile.organization_id;
  const userId = profile.id;

  const { data: companies } = await supabase
    .from("companies")
    .select("id, slug, name")
    .eq("organization_id", orgId)
    .is("archived_at", null);

  const bySlug = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const c of companies ?? []) {
    bySlug.set(c.slug.toLowerCase(), c.id);
    byName.set(c.name.toLowerCase(), c.id);
  }

  const errors: string[] = [];
  let skipped = 0;
  let inserted = 0;
  let updated = 0;

  // Group by company so each sheet is touched once.
  const byCompany = new Map<string, BulkMetricInput[]>();
  for (const r of rows) {
    const key = r.companyKey.trim().toLowerCase();
    const companyId = bySlug.get(key) ?? byName.get(key);
    if (!companyId) {
      errors.push(`Line ${r.lineNumber}: unknown company "${r.companyKey}"`);
      skipped++;
      continue;
    }
    const arr = byCompany.get(companyId) ?? [];
    arr.push(r);
    byCompany.set(companyId, arr);
  }

  for (const [companyId, drafts] of byCompany.entries()) {
    let { data: sheet } = await supabase
      .from("sheets")
      .select("id")
      .eq("company_id", companyId)
      .maybeSingle();
    if (!sheet) {
      const { data: created } = await supabase
        .from("sheets")
        .insert({ company_id: companyId, name: "KPIs", position: 0 })
        .select("id")
        .single();
      sheet = created;
    }
    if (!sheet) continue;
    const sheetId = sheet.id;

    const columnSpecs: Array<{ name: string; type: string; key: keyof BulkMetricInput }> = [
      { name: "Period",    type: "text",     key: "quarter"    },
      { name: "ARR",       type: "currency", key: "arrUsd"     },
      { name: "Burn",      type: "currency", key: "burnUsd"    },
      { name: "Cash",      type: "currency", key: "cashUsd"    },
      { name: "Revenue",   type: "currency", key: "revenueUsd" },
      { name: "Headcount", type: "number",   key: "headcount"  },
    ];

    const { data: existingCols } = await supabase
      .from("sheet_columns")
      .select("id, name, position")
      .eq("sheet_id", sheetId);
    const colByLabel = new Map<string, string>();
    let nextPosition = -1;
    for (const c of existingCols ?? []) {
      colByLabel.set(c.name.toLowerCase().trim(), c.id);
      if (c.position > nextPosition) nextPosition = c.position;
    }
    for (const spec of columnSpecs) {
      const lower = spec.name.toLowerCase();
      if (colByLabel.has(lower)) continue;
      nextPosition += 1;
      const { data: created } = await supabase
        .from("sheet_columns")
        .insert({
          sheet_id: sheetId,
          name: spec.name,
          type: spec.type,
          config: spec.type === "currency" ? { currency: "USD" } : {},
          position: nextPosition,
        } as any)
        .select("id")
        .single();
      if (created) colByLabel.set(lower, created.id);
    }

    const periodColId = colByLabel.get("period")!;
    const colId = (label: string) => colByLabel.get(label.toLowerCase()) ?? null;

    const { data: existingRows } = await supabase
      .from("sheet_rows")
      .select("id, data, position")
      .eq("sheet_id", sheetId);
    const rowsByPeriod = new Map<string, { id: string; data: any; position: number }>();
    let nextRowPosition = -1;
    for (const r of existingRows ?? []) {
      const data = (r.data ?? {}) as Record<string, any>;
      const periodLabel = String(data[periodColId] ?? "").trim();
      if (periodLabel) rowsByPeriod.set(periodLabel.toLowerCase(), r as any);
      if (r.position > nextRowPosition) nextRowPosition = r.position;
    }

    for (const draft of drafts) {
      const periodLabel = draft.quarter.trim();
      if (!periodLabel) continue;

      const patch: Record<string, any> = { [periodColId]: periodLabel };
      const setIf = (label: string, val: number | null) => {
        if (val == null) return;
        const cid = colId(label);
        if (cid) patch[cid] = val;
      };
      setIf("ARR", draft.arrUsd);
      setIf("Burn", draft.burnUsd);
      setIf("Cash", draft.cashUsd);
      setIf("Revenue", draft.revenueUsd);
      setIf("Headcount", draft.headcount);

      if (Object.keys(patch).length <= 1) {
        skipped++;
        continue;
      }

      const existing = rowsByPeriod.get(periodLabel.toLowerCase());
      if (existing) {
        const merged = { ...((existing.data ?? {}) as Record<string, any>), ...patch };
        const { error } = await supabase
          .from("sheet_rows")
          .update({ data: merged, updated_at: new Date().toISOString() } as any)
          .eq("id", existing.id);
        if (error) {
          errors.push(`Line ${draft.lineNumber}: ${error.message}`);
          skipped++;
          continue;
        }
        updated++;
      } else {
        nextRowPosition += 1;
        const { error } = await supabase
          .from("sheet_rows")
          .insert({ sheet_id: sheetId, data: patch, position: nextRowPosition } as any);
        if (error) {
          errors.push(`Line ${draft.lineNumber}: ${error.message}`);
          skipped++;
          continue;
        }
        inserted++;
      }
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/companies");
  revalidatePath("/dashboards");

  if (inserted + updated > 0) {
    await logUsageEvent({
      organizationId: orgId,
      userId,
      kind: "metrics_imported",
      count: inserted + updated,
      metadata: { inserted, updated, skipped },
    });
  }

  return { ok: true, inserted, updated, skipped, errors };
}

