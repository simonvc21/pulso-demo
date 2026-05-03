// L.6 — Client-safe types + pure helpers for newsletters. The server-only
// loaders + createClient live in lib/newsletter.ts.

export type NewsletterStatus = "draft" | "published";
export type NewsletterCadence = "monthly" | "quarterly" | "annual" | "ad_hoc";

export type Block =
  | { id: string; type: "text"; heading?: string | null; body: string }
  | { id: string; type: "kpi_grid"; heading?: string | null; items: KpiItem[] }
  | { id: string; type: "company_highlight"; companySlug: string; angle: string; body: string }
  | { id: string; type: "metric_chart"; companySlug: string; metric: "arr" | "burn" | "cash" | "revenue" | "headcount"; caption?: string | null }
  | { id: string; type: "watch_list"; heading?: string | null; companies: Array<{ slug: string; reason: string }> }
  | { id: string; type: "custom_metric_leaderboard"; metricDefinitionId: string; heading?: string | null }
  // L.6b — fund-level chart blocks (no company picker — they pull aggregates)
  | { id: string; type: "fund_arr_by_company"; heading?: string | null; caption?: string | null }
  | { id: string; type: "fund_arr_trend"; heading?: string | null; caption?: string | null }
  | { id: string; type: "sector_breakdown"; heading?: string | null; mode: "arr" | "invested" | "count" }
  | { id: string; type: "divider" };

export interface KpiItem {
  label: string;
  value: string;
  delta?: string | null;
  positive?: boolean | null;
}

export interface Newsletter {
  id: string;
  organizationId: string;
  periodLabel: string;
  cadence: NewsletterCadence;
  status: NewsletterStatus;
  coverTitle: string;
  coverSubtitle: string | null;
  heroMetricSummary: string | null;
  blocks: Block[];
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function defaultPeriodLabel(cadence: NewsletterCadence): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const monthShort = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  if (cadence === "monthly") return `${monthShort[m]} ${y}`;
  if (cadence === "quarterly") return `Q${Math.floor(m / 3) + 1} ${y}`;
  if (cadence === "annual") return `FY ${y}`;
  return `Update ${monthShort[m]} ${y}`;
}

export function newId(): string {
  return `b${Math.random().toString(36).slice(2, 10)}`;
}
