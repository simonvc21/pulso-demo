"use server";

// L.4b — Metric library server actions.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { periodColumnsFromQuarterString } from "@/lib/period";
import { logUsageEvent } from "@/lib/value-analytics";

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

// ---------------------------------------------------------------------------
// Apply / remove a metric definition for one or more companies
// ---------------------------------------------------------------------------

export type ApplyResult = { ok: true; added: number } | { ok: false; error: string };

export async function applyMetricToCompanies(input: {
  metricDefinitionId: string;
  companyIds: string[];
}): Promise<ApplyResult> {
  if (!input.metricDefinitionId) return { ok: false, error: "Metric required" };
  if (!input.companyIds || input.companyIds.length === 0) {
    return { ok: false, error: "Select at least one company" };
  }

  const ctx = await requireOrg();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  // Belt-and-suspenders: confirm metric belongs to this org.
  const { data: def } = await ctx.supabase
    .from("metric_definitions")
    .select("id")
    .eq("id", input.metricDefinitionId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!def) return { ok: false, error: "Metric not found" };

  // Filter to companies actually in this org.
  const { data: companies } = await ctx.supabase
    .from("companies")
    .select("id, slug")
    .in("id", input.companyIds)
    .eq("organization_id", ctx.organizationId);
  const validIds = new Set((companies ?? []).map((c) => c.id));
  const rows = input.companyIds
    .filter((id) => validIds.has(id))
    .map((company_id) => ({
      metric_definition_id: input.metricDefinitionId,
      company_id,
    }));
  if (rows.length === 0) return { ok: false, error: "No valid companies" };

  // Idempotent — UNIQUE(metric_definition_id, company_id) makes duplicates a no-op.
  const { error } = await ctx.supabase
    .from("metric_definition_companies")
    .upsert(rows as any, { onConflict: "metric_definition_id,company_id", ignoreDuplicates: true });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/metrics");
  for (const c of companies ?? []) revalidatePath(`/companies/${c.slug}`);
  revalidatePath("/companies");

  return { ok: true, added: rows.length };
}

export type RemoveResult = { ok: true } | { ok: false; error: string };

export async function removeMetricFromCompany(input: {
  metricDefinitionId: string;
  companyId: string;
  /** When true, also wipe any existing values for this pairing. */
  clearValues?: boolean;
}): Promise<RemoveResult> {
  if (!input.metricDefinitionId || !input.companyId) {
    return { ok: false, error: "Missing id" };
  }
  const ctx = await requireOrg();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  // Confirm both belong to this org.
  const { data: company } = await ctx.supabase
    .from("companies")
    .select("id, slug")
    .eq("id", input.companyId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!company) return { ok: false, error: "Company not found" };

  const { error } = await ctx.supabase
    .from("metric_definition_companies")
    .delete()
    .eq("metric_definition_id", input.metricDefinitionId)
    .eq("company_id", input.companyId);
  if (error) return { ok: false, error: error.message };

  if (input.clearValues) {
    await ctx.supabase
      .from("custom_metric_values")
      .delete()
      .eq("metric_definition_id", input.metricDefinitionId)
      .eq("company_id", input.companyId);
  }

  revalidatePath("/settings/metrics");
  revalidatePath(`/companies/${company.slug}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Bulk CSV import for custom metric values
// CSV shape: company,metric,period,value
//   company:  slug or name (case-insensitive)
//   metric:   label (case-insensitive). Auto-applied to the company if not yet.
//   period:   "Mar 2026" / "M03 2026" / "Q1 2026" / "FY 2026"
//   value:    number, blank = clear
// ---------------------------------------------------------------------------

export type BulkCustomRow = {
  companyKey: string;
  metricLabel: string;
  period: string;
  value: number | null;
  lineNumber: number;
};

export type BulkCustomResult =
  | { ok: true; inserted: number; updated: number; skipped: number; errors: string[] }
  | { ok: false; error: string };

export async function bulkUpsertCustomValues(rows: BulkCustomRow[]): Promise<BulkCustomResult> {
  if (!rows || rows.length === 0) return { ok: false, error: "Nothing to import" };

  const ctx = await requireOrg();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { supabase, organizationId, userId } = ctx;

  // Resolve all companies and metrics in this org once.
  const [{ data: companies }, { data: defs }] = await Promise.all([
    supabase.from("companies").select("id, slug, name").eq("organization_id", organizationId).is("archived_at", null),
    supabase.from("metric_definitions").select("id, label").eq("organization_id", organizationId),
  ]);
  const bySlug = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const c of companies ?? []) {
    bySlug.set(c.slug.toLowerCase(), c.id);
    byName.set(c.name.toLowerCase(), c.id);
  }
  const defByLabel = new Map<string, string>();
  for (const d of defs ?? []) defByLabel.set(d.label.toLowerCase(), d.id);

  const errors: string[] = [];
  type Insert = {
    company_id: string;
    metric_definition_id: string;
    quarter: string;
    period_year: number | null;
    period_month: number | null;
    period_kind: ReturnType<typeof periodColumnsFromQuarterString>["period_kind"];
    value: number | null;
  };
  const toUpsert: Insert[] = [];
  const toApply = new Set<string>(); // `${defId}|${companyId}` for auto-apply
  let skipped = 0;

  for (const r of rows) {
    const companyId = bySlug.get(r.companyKey.trim().toLowerCase())
      ?? byName.get(r.companyKey.trim().toLowerCase());
    if (!companyId) {
      errors.push(`Line ${r.lineNumber}: unknown company "${r.companyKey}"`);
      skipped++;
      continue;
    }
    const defId = defByLabel.get(r.metricLabel.trim().toLowerCase());
    if (!defId) {
      errors.push(`Line ${r.lineNumber}: unknown metric "${r.metricLabel}" — create it in Settings → Metrics first`);
      skipped++;
      continue;
    }
    const period = periodColumnsFromQuarterString(r.period);
    if (!period.period_year || !period.period_month) {
      errors.push(`Line ${r.lineNumber}: invalid period "${r.period}"`);
      skipped++;
      continue;
    }
    if (r.value != null && !Number.isFinite(r.value)) {
      errors.push(`Line ${r.lineNumber}: value must be a number`);
      skipped++;
      continue;
    }
    toUpsert.push({
      company_id: companyId,
      metric_definition_id: defId,
      quarter: r.period,
      period_year: period.period_year,
      period_month: period.period_month,
      period_kind: period.period_kind,
      value: r.value,
    });
    toApply.add(`${defId}|${companyId}`);
  }

  if (toUpsert.length === 0) {
    return { ok: true, inserted: 0, updated: 0, skipped, errors };
  }

  // Auto-apply each (metric, company) pairing so the chart shows up even
  // before any values land.
  const applyRows = Array.from(toApply).map((k) => {
    const [metric_definition_id, company_id] = k.split("|");
    return { metric_definition_id, company_id };
  });
  if (applyRows.length > 0) {
    await supabase
      .from("metric_definition_companies")
      .upsert(applyRows as any, {
        onConflict: "metric_definition_id,company_id",
        ignoreDuplicates: true,
      });
  }

  // Inserted vs updated count for the toast.
  const keyOf = (u: Insert) => `${u.company_id}|${u.metric_definition_id}|${u.quarter}`;
  const companyIds = Array.from(new Set(toUpsert.map((u) => u.company_id)));
  const defIds = Array.from(new Set(toUpsert.map((u) => u.metric_definition_id)));
  const periods = Array.from(new Set(toUpsert.map((u) => u.quarter)));
  const { data: existing } = await supabase
    .from("custom_metric_values")
    .select("company_id, metric_definition_id, quarter")
    .in("company_id", companyIds)
    .in("metric_definition_id", defIds)
    .in("quarter", periods);
  const existingSet = new Set(
    (existing ?? []).map((e) => `${e.company_id}|${e.metric_definition_id}|${e.quarter}`),
  );
  const updated = toUpsert.filter((u) => existingSet.has(keyOf(u))).length;
  const inserted = toUpsert.length - updated;

  const { error } = await supabase
    .from("custom_metric_values")
    .upsert(toUpsert as any, { onConflict: "company_id,metric_definition_id,quarter" });
  if (error) return { ok: false, error: error.message };

  // Revalidate touched company pages.
  const slugById = new Map<string, string>();
  for (const c of companies ?? []) slugById.set(c.id, c.slug);
  for (const cid of companyIds) {
    const slug = slugById.get(cid);
    if (slug) revalidatePath(`/companies/${slug}`);
  }
  revalidatePath("/settings/metrics");
  revalidatePath("/companies");

  if (inserted + updated > 0) {
    await logUsageEvent({
      organizationId,
      userId,
      kind: "metrics_imported",
      count: inserted + updated,
      metadata: { inserted, updated, skipped, kind: "custom" },
    });
  }

  return { ok: true, inserted, updated, skipped, errors };
}
