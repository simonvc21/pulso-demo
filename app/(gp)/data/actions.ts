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
