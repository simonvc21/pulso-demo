// L.6b — LP-facing fund portfolio dashboard. Mirrors the GP /dashboard view
// (KPIs, ARR by company, ARR trend, watch list) minus GP-only chrome.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { KpiCard } from "@/components/kpi-card";
import { PortfolioBarChart } from "@/components/portfolio-bar-chart";
import { ArrTrendChart } from "@/components/arr-trend-chart";
import { PortfolioMetricBarChart } from "@/components/portfolio-metric-bar-chart";
import { PortfolioTrendChart } from "@/components/portfolio-trend-chart";
import { RunwayDistribution } from "@/components/runway-distribution";
import { WatchList } from "@/components/watch-list";
import { fmtMoney } from "@/lib/utils";
import { getDashboardData, getNewsletterUpdates } from "@/lib/dashboard-data";
import { PortfolioNewsletter } from "@/components/portfolio-newsletter";
import { ts } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function LpPortfolioPage() {
  const [{ organization, companies, kpis, arrTrend, cashTrend, burnTrend, headcountTrend, watchList }, updates] = await Promise.all([
    getDashboardData(),
    getNewsletterUpdates(8),
  ]);

  const fundName = organization?.name ?? "Your fund";
  const fundSize = Number(organization?.size_usd ?? 0);
  const fundDeployed = Number(organization?.deployed_usd ?? 0);
  const deployedPct = fundSize > 0 ? Math.round((fundDeployed / fundSize) * 100) : 0;
  const ccy = organization?.currency ?? "USD";
  const latestPeriod = (() => {
    const allLabels: string[] = [];
    for (const c of companies) for (const m of c.metrics) allLabels.push(m.quarter);
    return allLabels[allLabels.length - 1] ?? "";
  })();

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
      <div>
        <Link href="/lp" className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-ink">
          <ArrowLeft className="h-3 w-3" /> Back to portal
        </Link>
        <div className="mt-3 text-[11px] font-semibold text-gold-600 tracking-[0.18em] uppercase">
          {fundName}{latestPeriod ? ` · ${latestPeriod}` : ""}
        </div>
        <h1 className="mt-2 text-3xl font-serif font-bold text-ink leading-tight">
          Fund portfolio overview
        </h1>
        <p className="mt-2 text-sm text-muted">
          Aggregated KPIs, ARR by company, multi-period trend, and watch list — read-only view of what your GP sees.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label={ts("dashboard.kpi_total_invested")}
          value={fmtMoney(fundDeployed, { compact: true }, ccy)}
          hint={`${deployedPct}% ${ts("dashboard.deployed")}`}
        />
        <KpiCard
          label={ts("dashboard.kpi_portfolio_arr")}
          value={fmtMoney(kpis.arrTotal, { compact: true }, ccy)}
          delta={{
            text: `${kpis.qoqArrGrowth >= 0 ? "+" : ""}${kpis.qoqArrGrowth.toFixed(1)}% MoM`,
            trend: kpis.qoqArrGrowth >= 0 ? "up" : "down",
          }}
          hint={`${companies.length} companies`}
        />
        <KpiCard
          label={ts("dashboard.kpi_yoy_growth")}
          value={`${kpis.yoyGrowth.toFixed(0)}%`}
          hint={ts("dashboard.weighted_by_arr")}
        />
        <KpiCard
          label={ts("dashboard.kpi_runway")}
          value={`${kpis.runwayMonths.toFixed(1)} mo`}
          hint={`${fmtMoney(kpis.cash, { compact: true }, ccy)} ${ts("dashboard.cash")}`}
        />
      </div>

      {/* ARR by company + watch list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-line shadow-card overflow-hidden">
          <div className="px-5 pt-4 pb-2 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-ink">{ts("dashboard.arr_by_company")}</h3>
              <p className="text-[11px] text-muted mt-0.5">{latestPeriod || "Latest month"} · USD, normalized</p>
            </div>
            <div className="hidden sm:flex gap-1 text-[10px]">
              <span className="inline-flex items-center gap-1.5 text-muted"><span className="h-1.5 w-1.5 rounded-full bg-teal" /> Healthy</span>
              <span className="inline-flex items-center gap-1.5 text-muted ml-3"><span className="h-1.5 w-1.5 rounded-full bg-gold" /> Watch</span>
              <span className="inline-flex items-center gap-1.5 text-muted ml-3"><span className="h-1.5 w-1.5 rounded-full bg-coral" /> Critical</span>
            </div>
          </div>
          <div className="px-2 pb-2">
            <PortfolioBarChart companies={companies} />
          </div>
        </div>
        <div className="lg:col-span-1">
          <WatchList items={watchList} />
        </div>
      </div>

      {/* Trend */}
      <div className="bg-white rounded-xl border border-line shadow-card overflow-hidden">
        <div className="px-5 pt-4 pb-2 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink">{ts("dashboard.trend")}</h3>
            <p className="text-[11px] text-muted mt-0.5">Aggregated portfolio ARR over time</p>
          </div>
        </div>
        <div className="px-2 pb-2">
          <ArrTrendChart data={arrTrend} />
        </div>
      </div>

      {/* L.6c — Cash + burn breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Cash on hand by company" subtitle="Latest period · USD millions">
          <PortfolioMetricBarChart companies={companies as any} metric="cash" units="millions" />
        </Section>
        <Section title="Monthly burn by company" subtitle="Latest period · USD thousands per month">
          <PortfolioMetricBarChart companies={companies as any} metric="burn" units="k_per_month" />
        </Section>
      </div>

      {/* L.6c — Runway distribution + aggregate headcount/cash trends */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Section title="Runway distribution" subtitle="# of companies per bucket">
          <RunwayDistribution companies={companies as any} />
        </Section>
        <Section title="Aggregate headcount" subtitle="Sum across the portfolio">
          <PortfolioTrendChart data={headcountTrend.map((p) => ({ label: p.quarter, value: p.value }))} units="raw" />
        </Section>
        <Section title="Aggregate cash" subtitle="Sum across the portfolio">
          <PortfolioTrendChart data={cashTrend.map((p) => ({ label: p.quarter, value: p.value }))} units="millions" />
        </Section>
      </div>

      {/* Narrative updates pulled from form submissions */}
      <PortfolioNewsletter updates={updates} />
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-line shadow-card overflow-hidden">
      <div className="px-5 pt-4 pb-2">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {subtitle && <p className="text-[11px] text-muted mt-0.5">{subtitle}</p>}
      </div>
      <div className="px-2 pb-3">{children}</div>
    </div>
  );
}
