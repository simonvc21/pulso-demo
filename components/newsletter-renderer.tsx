// L.6 — Newsletter renderer. Server component that resolves block references
// (company slugs, metric definitions) and composes the page. Used by:
//   - /newsletters/[id]          (GP preview)
//   - /lp/newsletters/[id]       (LP view)
//   - print stylesheet           (browser PDF export)

import { CompanyHistoryChart } from "@/components/company-history-chart";
import { CustomMetricChart } from "@/components/custom-metric-chart";
import { createClient } from "@/lib/supabase/server";
import type { Block, Newsletter } from "@/lib/newsletter";
import { fmtUSD } from "@/lib/utils";
// Inline minimal version of metricRowToLabel — keeps the renderer free of any
// extra import surface. Only handles month rows since L.12 monthlies-only.
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function metricRowToLabel(m: { period_year?: number; period_month?: number; quarter?: string }): string {
  const y = m.period_year, mo = m.period_month;
  if (y && mo && mo >= 1 && mo <= 12) return `${MONTHS[mo - 1]} ${y}`;
  return m.quarter ?? "";
}

interface ResolvedCompany {
  id: string;
  slug: string;
  name: string;
  metrics: Array<{ quarter: string; arr: number; burn: number; cash: number; headcount: number; revenue: number }>;
}

interface ResolvedCustomSeries {
  definitionId: string;
  label: string;
  unit: string | null;
  byCompany: Array<{ companyName: string; latest: number | null }>;
}

interface RenderedData {
  companies: Map<string, ResolvedCompany>;
  customSeries: Map<string, ResolvedCustomSeries>;
}

async function resolve(blocks: Block[]): Promise<RenderedData> {
  const supabase = createClient();
  const companySlugs = new Set<string>();
  const metricDefIds = new Set<string>();
  for (const b of blocks) {
    if (b.type === "company_highlight" || b.type === "metric_chart") companySlugs.add(b.companySlug);
    if (b.type === "watch_list") for (const c of b.companies) companySlugs.add(c.slug);
    if (b.type === "custom_metric_leaderboard") metricDefIds.add(b.metricDefinitionId);
  }

  const companies = new Map<string, ResolvedCompany>();
  if (companySlugs.size > 0) {
    const { data } = await supabase
      .from("companies")
      .select("id, slug, name, metrics(quarter, arr_usd, burn_usd, cash_usd, revenue_usd, headcount, period_year, period_month, period_kind)")
      .in("slug", Array.from(companySlugs));
    for (const c of (data ?? []) as any[]) {
      const metrics = ((c.metrics ?? []) as any[])
        .map((m) => ({
          quarter: metricRowToLabel(m),
          arr: Number(m.arr_usd ?? 0),
          burn: Number(m.burn_usd ?? 0),
          cash: Number(m.cash_usd ?? 0),
          revenue: Number(m.revenue_usd ?? 0),
          headcount: Number(m.headcount ?? 0),
          py: m.period_year ?? 0,
          pm: m.period_month ?? 0,
        }))
        .sort((a, b) => (a.py - b.py) || (a.pm - b.pm))
        .map(({ py, pm, ...rest }) => rest);
      companies.set(c.slug, { id: c.id, slug: c.slug, name: c.name, metrics });
    }
  }

  const customSeries = new Map<string, ResolvedCustomSeries>();
  if (metricDefIds.size > 0) {
    const { data: defs } = await supabase
      .from("metric_definitions")
      .select("id, label, unit")
      .in("id", Array.from(metricDefIds));
    const { data: vals } = await supabase
      .from("custom_metric_values")
      .select("metric_definition_id, value, period_year, period_month, companies(name)")
      .in("metric_definition_id", Array.from(metricDefIds));

    const valuesByDef = new Map<string, any[]>();
    for (const v of (vals ?? []) as any[]) {
      const arr = valuesByDef.get(v.metric_definition_id) ?? [];
      arr.push(v);
      valuesByDef.set(v.metric_definition_id, arr);
    }
    for (const d of (defs ?? []) as any[]) {
      const rows = (valuesByDef.get(d.id) ?? []).sort((a, b) =>
        (b.period_year - a.period_year) || (b.period_month - a.period_month)
      );
      const seenByCompany = new Map<string, number>();
      for (const r of rows) {
        const name = r.companies?.name ?? "—";
        if (!seenByCompany.has(name)) seenByCompany.set(name, Number(r.value ?? 0));
      }
      customSeries.set(d.id, {
        definitionId: d.id,
        label: d.label,
        unit: d.unit,
        byCompany: Array.from(seenByCompany.entries())
          .map(([companyName, latest]) => ({ companyName, latest }))
          .sort((a, b) => (b.latest ?? 0) - (a.latest ?? 0)),
      });
    }
  }

  return { companies, customSeries };
}

interface RendererProps {
  newsletter: Newsletter;
  /** When true, hides edit hints and shows publication metadata. */
  presentation?: boolean;
}

export async function NewsletterRenderer({ newsletter, presentation = true }: RendererProps) {
  const data = await resolve(newsletter.blocks);

  return (
    <article className="newsletter mx-auto max-w-3xl bg-white text-ink">
      {/* Cover */}
      <header className="px-8 pt-12 pb-8 border-b border-line">
        <div className="text-[11px] tracking-[0.2em] uppercase font-semibold text-gold-600">
          {newsletter.periodLabel} · {newsletter.cadence === "ad_hoc" ? "Special update" : `${newsletter.cadence} update`}
        </div>
        <h1 className="mt-2 font-serif text-3xl sm:text-4xl font-bold text-ink leading-tight">
          {newsletter.coverTitle}
        </h1>
        {newsletter.coverSubtitle && (
          <p className="mt-3 text-base text-muted leading-relaxed">{newsletter.coverSubtitle}</p>
        )}
        {newsletter.heroMetricSummary && (
          <div className="mt-5 inline-block px-3 py-1.5 rounded-full bg-paper2 text-[11px] font-medium text-ink">
            {newsletter.heroMetricSummary}
          </div>
        )}
        {presentation && newsletter.publishedAt && (
          <div className="mt-4 text-[11px] text-muted">
            Published {new Date(newsletter.publishedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </div>
        )}
      </header>

      {/* Body */}
      <div className="px-8 py-8 space-y-8">
        {newsletter.blocks.length === 0 ? (
          <p className="text-sm text-muted italic">No content yet. Add some blocks in the editor.</p>
        ) : (
          newsletter.blocks.map((b) => <BlockRender key={b.id} block={b} data={data} />)
        )}
      </div>

      <footer className="px-8 py-6 border-t border-line text-[11px] text-muted text-center">
        Generated by Pulso · {new Date(newsletter.updatedAt).toLocaleDateString("en-US")}
      </footer>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Block renderers
// ---------------------------------------------------------------------------

function BlockRender({ block, data }: { block: Block; data: RenderedData }) {
  switch (block.type) {
    case "text":
      return (
        <section>
          {block.heading && <h2 className="font-serif text-xl font-bold text-ink mb-3">{block.heading}</h2>}
          <div className="prose prose-sm max-w-none text-ink whitespace-pre-wrap leading-relaxed">
            {block.body}
          </div>
        </section>
      );

    case "kpi_grid":
      return (
        <section>
          {block.heading && <h2 className="font-serif text-xl font-bold text-ink mb-3">{block.heading}</h2>}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {block.items.map((kpi, i) => (
              <div key={i} className="rounded-xl border border-line bg-paper2/40 p-4">
                <div className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted">{kpi.label}</div>
                <div className="mt-1 font-serif text-xl font-bold text-ink leading-none tabular-nums">{kpi.value}</div>
                {kpi.delta && (
                  <div className={`mt-1.5 text-[11px] font-medium tabular-nums ${kpi.positive ? "text-teal-600" : "text-coral"}`}>
                    {kpi.delta}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      );

    case "company_highlight": {
      const c = data.companies.get(block.companySlug);
      const last = c?.metrics[c.metrics.length - 1];
      return (
        <section className="rounded-xl border border-line p-5 bg-white">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-serif text-lg font-bold text-ink">{c?.name ?? block.companySlug}</h3>
            {last && (
              <div className="text-[12px] text-muted tabular-nums">
                ARR {fmtUSD(last.arr, { compact: true })} · Cash {fmtUSD(last.cash, { compact: true })}
              </div>
            )}
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-wider text-gold-600 font-semibold">{block.angle}</div>
          <p className="mt-3 text-sm text-ink whitespace-pre-wrap leading-relaxed">{block.body}</p>
        </section>
      );
    }

    case "metric_chart": {
      const c = data.companies.get(block.companySlug);
      if (!c) return null;
      const colorMap: Record<typeof block.metric, string> = {
        arr: "#14B8A6",
        cash: "#0A1F44",
        revenue: "#F4B740",
        burn: "#E1654B",
        headcount: "#1B3A6F",
      };
      return (
        <section>
          <div className="flex items-baseline justify-between gap-3 mb-2">
            <h3 className="font-serif text-base font-semibold text-ink">
              {c.name} — {block.metric.toUpperCase()}
            </h3>
            {block.caption && <span className="text-[11px] text-muted">{block.caption}</span>}
          </div>
          <div className="rounded-xl border border-line p-2 bg-white">
            <CompanyHistoryChart metrics={c.metrics as any} metric={block.metric} color={colorMap[block.metric]} />
          </div>
        </section>
      );
    }

    case "watch_list":
      return (
        <section>
          {block.heading && <h2 className="font-serif text-xl font-bold text-ink mb-3">{block.heading}</h2>}
          <ul className="rounded-xl border border-line divide-y divide-line bg-white">
            {block.companies.map((c, i) => {
              const company = data.companies.get(c.slug);
              return (
                <li key={i} className="px-4 py-3 flex items-start gap-3">
                  <div className="h-2 w-2 rounded-full bg-coral shrink-0 mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-ink">{company?.name ?? c.slug}</div>
                    <div className="text-[12px] text-muted">{c.reason}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      );

    case "custom_metric_leaderboard": {
      const series = data.customSeries.get(block.metricDefinitionId);
      if (!series) return null;
      const top = series.byCompany.slice(0, 5);
      const max = Math.max(1, ...top.map((r) => r.latest ?? 0));
      return (
        <section>
          <h2 className="font-serif text-xl font-bold text-ink mb-3">
            {block.heading ?? `${series.label} — top performers`}
          </h2>
          <ul className="rounded-xl border border-line bg-white p-4 space-y-3">
            {top.map((row, i) => {
              const pct = max > 0 ? Math.round(((row.latest ?? 0) / max) * 100) : 0;
              return (
                <li key={i}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-ink font-medium truncate">{row.companyName}</span>
                    <span className="text-ink tabular-nums">
                      {row.latest != null ? row.latest.toLocaleString("en-US") : "—"}
                      {series.unit ? ` ${series.unit}` : ""}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-paper2 overflow-hidden">
                    <div className="h-full bg-teal-600" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      );
    }

    case "divider":
      return <hr className="border-line" />;
  }
}

// CustomMetricChart import retained even if unused above so future block types
// pulling per-metric history have a chart available without a new import.
void CustomMetricChart;
