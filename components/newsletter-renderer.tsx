// L.6 — Newsletter renderer. Server component that resolves block references
// (company slugs, metric definitions) and composes the page. Used by:
//   - /newsletters/[id]          (GP preview)
//   - /lp/newsletters/[id]       (LP view)
//   - print stylesheet           (browser PDF export)

import { CompanyHistoryChart } from "@/components/company-history-chart";
import { PortfolioBarChart } from "@/components/portfolio-bar-chart";
import { ArrTrendChart } from "@/components/arr-trend-chart";
import { PieChartCard } from "@/components/pie-chart";
import { createClient } from "@/lib/supabase/server";
import type { Block, Newsletter } from "@/lib/newsletter";
import { fmtUSD } from "@/lib/utils";
import { getDashboardData, getFund } from "@/lib/dashboard-data";
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
  logoUrl: string | null;
  metrics: Array<{ quarter: string; arr: number; burn: number; cash: number; headcount: number; revenue: number }>;
}

interface FundData {
  // Shape lifted from getDashboardData but only the bits we render.
  companies: Array<{ slug: string; name: string; status: string; metrics: any[] }>;
  arrTrend: Array<{ quarter: string; arr: number }>;
  sectorBreakdown: Array<{ sector: string; arr: number; invested: number; count: number }>;
}

interface RenderedData {
  companies: Map<string, ResolvedCompany>;
  /** L.6e — name-keyed lookup so text blocks whose heading is a company
   *  name (auto-draft pattern) can render the company's logo. */
  companiesByName: Map<string, ResolvedCompany>;
  fund: FundData | null;
}

async function resolve(blocks: Block[]): Promise<RenderedData> {
  const supabase = createClient();
  const companySlugs = new Set<string>();
  let needsFundData = false;
  let needsSectorBreakdown = false;
  for (const b of blocks) {
    if (b.type === "company_highlight" || b.type === "metric_chart") companySlugs.add(b.companySlug);
    if (b.type === "watch_list") for (const c of b.companies) companySlugs.add(c.slug);
    if (b.type === "fund_arr_by_company" || b.type === "fund_arr_trend") needsFundData = true;
    if (b.type === "sector_breakdown") {
      needsFundData = true;
      needsSectorBreakdown = true;
    }
  }

  const companies = new Map<string, ResolvedCompany>();
  const companiesByName = new Map<string, ResolvedCompany>();

  // L.6e — Resolve every referenced company AND load lightweight (no metrics)
  // records for every active company in the org. The latter lets text blocks
  // whose heading is a company name (auto-draft "Portfolio Updates" section)
  // render the company's logo without per-block plumbing.
  if (companySlugs.size > 0) {
    const { data } = await supabase
      .from("companies")
      .select("id, slug, name, logo_url")
      .in("slug", Array.from(companySlugs));
    for (const c of (data ?? []) as any[]) {
      // Metrics now live in sheets per company. Newsletter chart blocks that
      // depend on metrics will render empty until we wire the sheet reader
      // here — text blocks (the bulk of letters) keep working.
      const resolved: ResolvedCompany = {
        id: c.id, slug: c.slug, name: c.name, logoUrl: c.logo_url ?? null, metrics: [],
      };
      companies.set(c.slug, resolved);
      companiesByName.set(c.name.toLowerCase(), resolved);
    }
  }

  // L.6e — extra pass: pull logo for every active org company (cheap; ~8 rows)
  // so per-company text blocks find logos by name even when nothing else
  // referenced that slug directly.
  const { data: allCompanies } = await supabase
    .from("companies")
    .select("id, slug, name, logo_url")
    .is("archived_at", null);
  for (const c of (allCompanies ?? []) as any[]) {
    if (companiesByName.has(c.name.toLowerCase())) continue;
    const resolved: ResolvedCompany = {
      id: c.id, slug: c.slug, name: c.name, logoUrl: c.logo_url ?? null, metrics: [],
    };
    companiesByName.set(c.name.toLowerCase(), resolved);
    if (!companies.has(c.slug)) companies.set(c.slug, resolved);
  }

  let fund: FundData | null = null;
  if (needsFundData) {
    const ds = await getDashboardData();
    let sectorBreakdown: FundData["sectorBreakdown"] = [];
    if (needsSectorBreakdown) {
      // Pull sector + invested for breakdown views.
      const { data: companyRows } = await supabase
        .from("companies")
        .select("sector, invested_usd, status")
        .is("archived_at", null);
      const byKey = new Map<string, { arr: number; invested: number; count: number }>();
      const arrBySlug = new Map<string, number>();
      for (const c of ds.companies) {
        arrBySlug.set(c.slug, c.metrics[c.metrics.length - 1]?.arr ?? 0);
      }
      // Walk companies again (we need sector from the supabase query for the
      // dashboard-data view doesn't expose it).
      for (const c of (companyRows ?? []) as any[]) {
        const key = c.sector?.trim() || "Uncategorized";
        const cur = byKey.get(key) ?? { arr: 0, invested: 0, count: 0 };
        cur.invested += Number(c.invested_usd ?? 0);
        cur.count += 1;
        byKey.set(key, cur);
      }
      // Add ARR by joining to the dashboard data on slug — but we already
      // averaged over `companies`, so re-walk using ds.companies (which has
      // ARR) joined back to sector via a quick lookup.
      const { data: slugToSector } = await supabase
        .from("companies")
        .select("slug, sector")
        .is("archived_at", null);
      const sectorBySlug = new Map<string, string>();
      for (const r of (slugToSector ?? []) as any[]) {
        sectorBySlug.set(r.slug, r.sector?.trim() || "Uncategorized");
      }
      for (const c of ds.companies) {
        const sector = sectorBySlug.get(c.slug) ?? "Uncategorized";
        const cur = byKey.get(sector) ?? { arr: 0, invested: 0, count: 0 };
        cur.arr += c.metrics[c.metrics.length - 1]?.arr ?? 0;
        byKey.set(sector, cur);
      }
      sectorBreakdown = Array.from(byKey.entries())
        .map(([sector, v]) => ({ sector, ...v }))
        .sort((a, b) => b.arr - a.arr);
    }
    fund = {
      companies: ds.companies as any,
      arrTrend: ds.arrTrend,
      sectorBreakdown,
    };
  }

  return { companies, companiesByName, fund };
}

interface RendererProps {
  newsletter: Newsletter;
  /** When true, hides edit hints and shows publication metadata. */
  presentation?: boolean;
}

export async function NewsletterRenderer({ newsletter, presentation = true }: RendererProps) {
  const [data, fund] = await Promise.all([resolve(newsletter.blocks), getFund()]);
  const fundLogoUrl = fund?.logo_url ?? null;
  const fundName = fund?.name ?? null;

  return (
    <article className="newsletter mx-auto max-w-3xl bg-white text-ink">
      {/* Cover */}
      <header className="px-8 pt-12 pb-8 border-b border-line">
        <div className="flex items-start gap-5">
          {/* L.6e — Fund logo on the cover. Falls back to a navy mark with the
              fund's first initial when no logo is uploaded. */}
          {fundLogoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={fundLogoUrl}
              alt={fundName ?? "Fund logo"}
              data-keep-white="true"
              className="h-16 w-16 rounded-xl object-contain bg-white border border-line shrink-0"
            />
          ) : fundName ? (
            <div className="h-16 w-16 rounded-xl bg-navy flex items-center justify-center text-gold font-serif text-2xl font-bold shrink-0">
              {fundName[0]}
            </div>
          ) : null}
          <div className="flex-1 min-w-0">
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
          </div>
        </div>
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

function CompanyLogo({
  url, name, size = 40,
}: { url: string | null; name: string; size?: number }) {
  if (url) {
    /* eslint-disable-next-line @next/next/no-img-element */
    return (
      <img
        src={url}
        alt={name}
        data-keep-white="true"
        className="rounded-lg object-contain bg-white border border-line shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-lg bg-navy flex items-center justify-center text-gold font-serif font-bold shrink-0"
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.4) }}
    >
      {name[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

function BlockRender({ block, data }: { block: Block; data: RenderedData }) {
  switch (block.type) {
    case "text": {
      // L.6e — When the heading matches a company name (the auto-draft per-
      // company "Portfolio Updates" pattern), render the company logo next to
      // the heading. Plain text blocks stay heading-only.
      const companyForHeading = block.heading
        ? data.companiesByName.get(block.heading.trim().toLowerCase())
        : null;
      return (
        <section>
          {block.heading && (
            companyForHeading ? (
              <div className="flex items-center gap-3 mb-3">
                <CompanyLogo url={companyForHeading.logoUrl} name={companyForHeading.name} size={40} />
                <h2 className="font-serif text-xl font-bold text-ink">{block.heading}</h2>
              </div>
            ) : (
              <h2 className="font-serif text-xl font-bold text-ink mb-3">{block.heading}</h2>
            )
          )}
          <div className="prose prose-sm max-w-none text-ink whitespace-pre-wrap leading-relaxed">
            {block.body}
          </div>
        </section>
      );
    }

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
          <div className="flex items-start gap-4">
            <CompanyLogo url={c?.logoUrl ?? null} name={c?.name ?? block.companySlug} size={48} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-serif text-lg font-bold text-ink">{c?.name ?? block.companySlug}</h3>
                {last && (
                  <div className="text-[12px] text-muted tabular-nums shrink-0">
                    ARR {fmtUSD(last.arr, { compact: true })} · Cash {fmtUSD(last.cash, { compact: true })}
                  </div>
                )}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-wider text-gold-600 font-semibold">{block.angle}</div>
              <p className="mt-3 text-sm text-ink whitespace-pre-wrap leading-relaxed">{block.body}</p>
            </div>
          </div>
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
                <li key={i} className="px-4 py-3 flex items-center gap-3">
                  <CompanyLogo url={company?.logoUrl ?? null} name={company?.name ?? c.slug} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-ink">{company?.name ?? c.slug}</div>
                    <div className="text-[12px] text-muted">{c.reason}</div>
                  </div>
                  <div className="h-2 w-2 rounded-full bg-coral shrink-0" />
                </li>
              );
            })}
          </ul>
        </section>
      );

    case "fund_arr_by_company": {
      if (!data.fund) return null;
      return (
        <section>
          <h2 className="font-serif text-xl font-bold text-ink mb-2">
            {block.heading ?? "ARR by company"}
          </h2>
          {block.caption && <p className="text-[12px] text-muted mb-2">{block.caption}</p>}
          <div className="rounded-xl border border-line bg-white p-2 -mx-1">
            <PortfolioBarChart companies={data.fund.companies as any} />
          </div>
        </section>
      );
    }

    case "fund_arr_trend": {
      if (!data.fund) return null;
      return (
        <section>
          <h2 className="font-serif text-xl font-bold text-ink mb-2">
            {block.heading ?? "Aggregated portfolio ARR"}
          </h2>
          {block.caption && <p className="text-[12px] text-muted mb-2">{block.caption}</p>}
          <div className="rounded-xl border border-line bg-white p-2 -mx-1">
            <ArrTrendChart data={data.fund.arrTrend} />
          </div>
        </section>
      );
    }

    case "sector_breakdown": {
      if (!data.fund || data.fund.sectorBreakdown.length === 0) return null;
      const rows = data.fund.sectorBreakdown;
      const total = Math.max(1, rows.reduce((a, r) =>
        a + (block.mode === "invested" ? r.invested : block.mode === "count" ? r.count : r.arr), 0));
      const fmtVal = (r: typeof rows[number]) => {
        if (block.mode === "invested") return fmtUSD(r.invested, { compact: true });
        if (block.mode === "count")    return `${r.count} ${r.count === 1 ? "company" : "companies"}`;
        return fmtUSD(r.arr, { compact: true });
      };
      const valOf = (r: typeof rows[number]) =>
        block.mode === "invested" ? r.invested : block.mode === "count" ? r.count : r.arr;

      const heading = block.heading ?? `Portfolio mix by sector — ${block.mode === "invested" ? "invested capital" : block.mode === "count" ? "number of companies" : "ARR"}`;

      // L.9a — Donut option for newsletter pie/donut visuals.
      if (block.display === "donut") {
        const pieData = rows.map((r) => ({ label: r.sector, value: valOf(r) }));
        return (
          <section>
            <h2 className="font-serif text-xl font-bold text-ink mb-3">{heading}</h2>
            <div className="rounded-xl border border-line bg-white p-4">
              <PieChartCard
                data={pieData}
                inner={60}
                showLegend
                formatValue={(v) =>
                  block.mode === "invested" ? fmtUSD(v, { compact: true })
                  : block.mode === "count" ? `${v}`
                  : fmtUSD(v, { compact: true })}
              />
            </div>
          </section>
        );
      }

      // Default: horizontal bars (more readable for >6 segments).
      return (
        <section>
          <h2 className="font-serif text-xl font-bold text-ink mb-3">{heading}</h2>
          <ul className="rounded-xl border border-line bg-white p-4 space-y-3">
            {rows.map((r) => {
              const pct = (valOf(r) / total) * 100;
              return (
                <li key={r.sector}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-ink font-medium truncate">{r.sector}</span>
                    <span className="text-ink tabular-nums">
                      {fmtVal(r)} <span className="text-muted text-[11px]">({pct.toFixed(0)}%)</span>
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
