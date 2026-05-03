"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DATA_METRICS, type DataMetricKey } from "@/lib/data-metrics";

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
  if (!/^Q[1-4]\s+\d{4}$/.test(input.quarter)) return { ok: false, error: "Invalid quarter format" };
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
    const { error } = await supabase
      .from("metrics")
      .insert({
        company_id: input.companyId,
        quarter: input.quarter,
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
    .select("organization_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!profile?.organization_id) return { ok: false, error: "No fund assigned" };
  const orgId = profile.organization_id;

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
    toUpsert.push({
      company_id: companyId,
      quarter: r.quarter,
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

  return { ok: true, inserted, updated, skipped, errors };
}
