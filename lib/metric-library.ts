// L.4b — Metric library loader. Server-only.

import { createClient } from "@/lib/supabase/server";
import type { CustomMetricType } from "@/lib/dashboard-data";

export interface LibraryMetric {
  id: string;
  label: string;
  type: CustomMetricType;
  unit: string | null;
  /** Companies this metric currently applies to (joined via
   *  metric_definition_companies). Independent of whether values exist yet. */
  appliedCompanyIds: string[];
  /** How many cells have a non-null value across all applied companies. */
  filledValueCount: number;
}

export interface LibraryCompany {
  id: string;
  slug: string;
  name: string;
}

export interface MetricLibrary {
  metrics: LibraryMetric[];
  companies: LibraryCompany[];
}

export async function getMetricLibrary(): Promise<MetricLibrary> {
  const supabase = createClient();

  // Three queries in parallel.
  const [{ data: defs }, { data: applies }, { data: companies }] = await Promise.all([
    supabase
      .from("metric_definitions")
      .select("id, label, type, unit")
      .order("label"),
    supabase
      .from("metric_definition_companies")
      .select("metric_definition_id, company_id"),
    supabase
      .from("companies")
      .select("id, slug, name")
      .order("name"),
  ]);

  // Aggregate value counts per definition (one query, server-side group-by).
  const { data: valueCounts } = await supabase
    .from("custom_metric_values")
    .select("metric_definition_id")
    .not("value", "is", null);

  const valuesByDef = new Map<string, number>();
  for (const r of (valueCounts ?? []) as any[]) {
    valuesByDef.set(r.metric_definition_id, (valuesByDef.get(r.metric_definition_id) ?? 0) + 1);
  }

  const appliedByDef = new Map<string, string[]>();
  for (const r of (applies ?? []) as any[]) {
    const arr = appliedByDef.get(r.metric_definition_id) ?? [];
    arr.push(r.company_id);
    appliedByDef.set(r.metric_definition_id, arr);
  }

  const metrics: LibraryMetric[] = ((defs ?? []) as any[]).map((d) => ({
    id: d.id,
    label: d.label,
    type: d.type,
    unit: d.unit,
    appliedCompanyIds: appliedByDef.get(d.id) ?? [],
    filledValueCount: valuesByDef.get(d.id) ?? 0,
  }));

  return {
    metrics,
    companies: (companies ?? []).map((c: any) => ({ id: c.id, slug: c.slug, name: c.name })),
  };
}
