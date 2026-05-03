"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DATA_METRICS, type DataMetricKey } from "@/lib/data-metrics";
import { logUsageEvent } from "@/lib/value-analytics";
import { periodColumnsFromQuarterString, type PeriodKind } from "@/lib/period";

const KEYS = new Set<string>(DATA_METRICS.map((m) => m.key));

export type UpdateMetricInput = {
  companyId: string;
  quarter: string;             // e.g. "Q1 2026"
  key: DataMetricKey;
  value: number | null;        // null clears the cell
};

export type UpdateMetricResult = { ok: true } | { ok: false; error: string };

export async function updateMetricCell(input: UpdateMetricInput): Promise<UpdateMetricResult> {
  if (!input.companyId) return { ok: false, error: "Company id is required" };
  // L.12 — accept Q1 2026, M03 2026, Mar 2026, FY 2026
  if (!periodColumnsFromQuarterString(input.quarter).period_year) {
    return { ok: false, error: "Invalid period format" };
  }
  if (!KEYS.has(input.key)) return { ok: false, error: "Invalid metric key" };
  if (input.value != null && !Number.isFinite(input.value)) {
    return { ok: false, error: "Value must be a number" };
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  // Confirm the company belongs to the caller's org via RLS — the select
  // will return null if it doesn't.
  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("id", input.companyId)
    .maybeSingle();
  if (!company) return { ok: false, error: "Company not found" };

  // Upsert by (company_id, quarter)
  const { data: existing } = await supabase
    .from("metrics")
    .select("id")
    .eq("company_id", input.companyId)
    .eq("quarter", input.quarter)
    .maybeSingle();

  // Postgrest's typed clients want a static shape; we know the column is
  // valid (validated above), so cast through any for the dynamic key.
  if (existing) {
    const { error } = await supabase
      .from("metrics")
      .update({ [input.key]: input.value } as any)
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const period = periodColumnsFromQuarterString(input.quarter);
    const { error } = await supabase
      .from("metrics")
      .insert({
        company_id: input.companyId,
        quarter: input.quarter,
        period_year: period.period_year,
        period_month: period.period_month,
        period_kind: period.period_kind,
        [input.key]: input.value,
      } as any);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/data");
  revalidatePath("/dashboard");
  revalidatePath(`/companies`);
  return { ok: true };
}

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

  // Pull every company once so we can resolve by either slug or name.
  const { data: companies } = await supabase
    .from("companies")
    .select("id, slug, name")
    .eq("organization_id", orgId);

  const bySlug = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const c of companies ?? []) {
    bySlug.set(c.slug.toLowerCase(), c.id);
    byName.set(c.name.toLowerCase(), c.id);
  }

  const errors: string[] = [];
  type Insert = {
    company_id: string;
    quarter: string;
    period_year: number | null;
    period_month: number | null;
    period_kind: PeriodKind;
    arr_usd: number | null;
    burn_usd: number | null;
    cash_usd: number | null;
    revenue_usd: number | null;
    headcount: number | null;
  };
  const toUpsert: Insert[] = [];
  let skipped = 0;

  for (const r of rows) {
    const key = r.companyKey.trim().toLowerCase();
    const companyId = bySlug.get(key) ?? byName.get(key);
    if (!companyId) {
      errors.push(`Line ${r.lineNumber}: unknown company "${r.companyKey}"`);
      skipped++;
      continue;
    }
    const period = periodColumnsFromQuarterString(r.quarter);
    toUpsert.push({
      company_id: companyId,
      quarter: r.quarter,
      period_year: period.period_year,
      period_month: period.period_month,
      period_kind: period.period_kind,
      arr_usd: r.arrUsd,
      burn_usd: r.burnUsd,
      cash_usd: r.cashUsd,
      revenue_usd: r.revenueUsd,
      headcount: r.headcount,
    });
  }

  if (toUpsert.length === 0) {
    return { ok: true, inserted: 0, updated: 0, skipped, errors };
  }

  // Find which (company_id, quarter) rows already exist so we can report
  // accurate inserted/updated counts.
  const keys = toUpsert.map((u) => ({ c: u.company_id, q: u.quarter }));
  const companyIds = Array.from(new Set(keys.map((k) => k.c)));
  const quarters = Array.from(new Set(keys.map((k) => k.q)));
  const { data: existing } = await supabase
    .from("metrics")
    .select("company_id, quarter")
    .in("company_id", companyIds)
    .in("quarter", quarters);
  const existingSet = new Set((existing ?? []).map((m) => `${m.company_id}|${m.quarter}`));
  const updated = toUpsert.filter((u) => existingSet.has(`${u.company_id}|${u.quarter}`)).length;
  const inserted = toUpsert.length - updated;

  const { error } = await supabase
    .from("metrics")
    .upsert(toUpsert as any, { onConflict: "company_id,quarter" });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/data");
  revalidatePath("/dashboard");
  revalidatePath("/companies");

  // L.20 — emit one value event per imported metric row so the "hours saved"
  // estimate scales with import size (1 min/row manual is the heuristic).
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

// ---------------------------------------------------------------------------
// L.3 — Per-org column config + per-cell metric notes
// ---------------------------------------------------------------------------

import { parseDataColumnsConfig, type DataColumnsConfig } from "@/lib/data-columns-config";

async function requireOrg() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };
  const { data: profile } = await supabase
    .from("users")
    .select("id, organization_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!profile?.organization_id) return { ok: false as const, error: "No fund assigned" };
  return {
    ok: true as const,
    supabase,
    organizationId: profile.organization_id,
    userId: profile.id,
  };
}

export type SaveColumnsResult = { ok: true } | { ok: false; error: string };

export async function saveDataColumnsConfig(input: DataColumnsConfig): Promise<SaveColumnsResult> {
  const ctx = await requireOrg();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const clean = parseDataColumnsConfig(input);

  const { error } = await ctx.supabase
    .from("organizations")
    .update({ data_columns_json: clean as any })
    .eq("id", ctx.organizationId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/data");
  return { ok: true };
}

export type NoteResult = { ok: true } | { ok: false; error: string };

export async function upsertMetricNote(input: {
  companyId: string;
  quarter: string;
  metricKey: DataMetricKey;
  note: string;
}): Promise<NoteResult> {
  if (!input.companyId) return { ok: false, error: "Company id is required" };
  if (!periodColumnsFromQuarterString(input.quarter).period_year) {
    return { ok: false, error: "Invalid period format" };
  }
  if (!KEYS.has(input.metricKey)) return { ok: false, error: "Invalid metric key" };
  const trimmed = input.note.trim();
  if (!trimmed) return { ok: false, error: "Note is empty" };
  if (trimmed.length > 2000) return { ok: false, error: "Note must be ≤ 2000 chars" };

  const ctx = await requireOrg();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  // RLS will block if the company isn't in the caller's org.
  const { error } = await ctx.supabase
    .from("metric_notes")
    .upsert(
      {
        company_id: input.companyId,
        quarter: input.quarter,
        metric_key: input.metricKey,
        note: trimmed,
        author_user_id: ctx.userId,
      },
      { onConflict: "company_id,quarter,metric_key" },
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/data");
  return { ok: true };
}

export async function deleteMetricNote(input: {
  companyId: string;
  quarter: string;
  metricKey: DataMetricKey;
}): Promise<NoteResult> {
  if (!input.companyId) return { ok: false, error: "Company id is required" };
  if (!periodColumnsFromQuarterString(input.quarter).period_year) {
    return { ok: false, error: "Invalid period format" };
  }
  if (!KEYS.has(input.metricKey)) return { ok: false, error: "Invalid metric key" };

  const ctx = await requireOrg();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("metric_notes")
    .delete()
    .eq("company_id", input.companyId)
    .eq("quarter", input.quarter)
    .eq("metric_key", input.metricKey);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/data");
  return { ok: true };
}
