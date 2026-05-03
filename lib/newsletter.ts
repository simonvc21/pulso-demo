// L.6 — Server-only loaders for newsletters. Types + pure helpers re-exported
// from lib/newsletter-types.ts so client components don't drag the server
// import graph along with them.

import { createClient } from "@/lib/supabase/server";
import type { Block, Newsletter } from "./newsletter-types";

export type { Block, KpiItem, Newsletter, NewsletterCadence, NewsletterStatus } from "./newsletter-types";
export { defaultPeriodLabel, newId } from "./newsletter-types";

function rowToNewsletter(r: any): Newsletter {
  return {
    id: r.id,
    organizationId: r.organization_id,
    periodLabel: r.period_label,
    cadence: r.cadence,
    status: r.status,
    coverTitle: r.cover_title,
    coverSubtitle: r.cover_subtitle ?? null,
    heroMetricSummary: r.hero_metric_summary ?? null,
    blocks: Array.isArray(r.sections_json) ? (r.sections_json as Block[]) : [],
    publishedAt: r.published_at ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listNewsletters(opts?: { publishedOnly?: boolean }): Promise<Newsletter[]> {
  const supabase = createClient();
  let query = (supabase as any)
    .from("newsletters")
    .select("*")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (opts?.publishedOnly) query = query.eq("status", "published");
  const { data } = await query;
  return ((data ?? []) as any[]).map(rowToNewsletter);
}

export async function getNewsletter(id: string): Promise<Newsletter | null> {
  const supabase = createClient();
  const { data } = await (supabase as any)
    .from("newsletters")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ? rowToNewsletter(data) : null;
}
