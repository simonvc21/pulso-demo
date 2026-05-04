import Link from "next/link";
import { Download, Share2 } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { TopbarBell } from "@/components/topbar-bell";
import { KpiCard } from "@/components/kpi-card";
import { PortfolioBarChart } from "@/components/portfolio-bar-chart";
import { ArrTrendChart } from "@/components/arr-trend-chart";
import { PortfolioMetricBarChart } from "@/components/portfolio-metric-bar-chart";
import { PortfolioTrendChart } from "@/components/portfolio-trend-chart";
import { RunwayDistribution } from "@/components/runway-distribution";
import { WatchList } from "@/components/watch-list";
import { ActivityFeed } from "@/components/activity-feed";
import { Button } from "@/components/ui/button";
import { fmtMoney } from "@/lib/utils";
import { getDashboardData, getNewsletterUpdates } from "@/lib/dashboard-data";
import { getLatestArrFromSheets } from "@/lib/sheets-arr";
import { PortfolioNewsletter } from "@/components/portfolio-newsletter";
import { DashboardAIBanner } from "@/components/dashboard-ai-banner";
import { ts } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [{ organization, companies, kpis, arrTrend, cashTrend, burnTrend, headcountTrend, watchList }, updates, sheetsArr] = await Promise.all([
    getDashboardData(),
    getNewsletterUpdates(8),
    getLatestArrFromSheets(),
  ]);

  // L.10 / Fase 1.7 — Override the latest-period ARR with whatever the
  // company's "KPIs trimestrales" sheet says (column "ARR"). When the sheet
  // doesn't exist or has no value, leave the legacy `metrics` value intact so
  // the dashboard keeps rendering during the transition window.
  const companiesForArrChart = companies.map((c) => {
    const sheetArr = sheetsArr.get(c.id);
    if (sheetArr == null || c.metrics.length === 0) return c;
    const lastIdx = c.metrics.length - 1;
    const next = [...c.metrics];
    next[lastIdx] = { ...next[lastIdx], arr: sheetArr };
    return { ...c, metrics: next };
  });

  const fundName = organization?.name ?? "Your fund";
  const fundSize = Number(organization?.size_usd ?? 0);
  const fundDeployed = Number(organization?.deployed_usd ?? 0);
  // L.7 — currency-aware display. All amounts stored as USD, shown in the
  // org's chosen currency symbol.
  const ccy = organization?.currency ?? "USD";
  const deployedPct = fundSize > 0 ? Math.round((fundDeployed / fundSize) * 100) : 0;
  const newThisQ = 2;
  // L.12 — Latest period label across the portfolio (e.g. "Mar 2026"). Pulled
  // from the most recent metric row in the dashboard data.
  const latestPeriod = (() => {
    const allLabels: string[] = [];
    for (const c of companies) for (const m of c.metrics) allLabels.push(m.quarter);
    return allLabels[allLabels.length - 1] ?? "";
  })();

  return (
    <>
      <Topbar
        bell={<TopbarBell />}
        title={ts("dashboard.title")}
        breadcrumb={`${fundName}${latestPeriod ? ` · ${latestPeriod}` : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <a href="/api/export/companies">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> {ts("dashboard.export_csv")}
              </Button>
            </a>
            <Link href="/share/q1-2026-lp-letter?preview=1" target="_blank">
              <Button variant="gold" size="sm" className="gap-1.5">
                <Share2 className="h-3.5 w-3.5" /> {ts("dashboard.share_with_lps")}
              </Button>
            </Link>
          </div>
        }
      />

      <div className="px-8 py-6 space-y-6 animate-fade-in">
        {/* AI insight banner — dismissable, persists 24h via localStorage */}
        <DashboardAIBanner
          qoqGrowth={kpis.qoqArrGrowth}
          flaggedCount={watchList.length}
          label={ts("dashboard.ai_banner_label")}
        />

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label={ts("dashboard.kpi_total_invested")}
            value={fmtMoney(fundDeployed, { compact: true }, ccy)}
            delta={{ text: "+ $4.1M MoM", trend: "up" }}
            hint={`${deployedPct}% ${ts("dashboard.deployed")}`}
          />
          <KpiCard
            label={ts("dashboard.kpi_portfolio_arr")}
            value={fmtMoney(kpis.arrTotal, { compact: true }, ccy)}
            delta={{ text: `${kpis.qoqArrGrowth >= 0 ? "+" : ""}${kpis.qoqArrGrowth.toFixed(1)}% MoM`, trend: kpis.qoqArrGrowth >= 0 ? "up" : "down" }}
            hint={`${newThisQ} ${ts("dashboard.new_this_q")}`}
          />
          <KpiCard
            label={ts("dashboard.kpi_yoy_growth")}
            value={`${kpis.yoyGrowth.toFixed(0)}%`}
            delta={{ text: ts("dashboard.top_quartile"), trend: "up" }}
            hint={ts("dashboard.weighted_by_arr")}
          />
          <KpiCard
            label={ts("dashboard.kpi_runway")}
            value={`${kpis.runwayMonths.toFixed(1)} mo`}
            delta={{ text: "− 1.8 mo MoM", trend: "down" }}
            hint={`${fmtMoney(kpis.cash, { compact: true }, ccy)} ${ts("dashboard.cash")}`}
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* ARR by company (bar chart) */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-line shadow-card overflow-hidden">
            <div className="px-5 pt-4 pb-2 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-ink">{ts("dashboard.arr_by_company")}</h3>
                <p className="text-[11px] text-muted mt-0.5">{latestPeriod || "Latest month"} · USD, normalized</p>
              </div>
              <div className="flex gap-1 text-[10px]">
                <span className="inline-flex items-center gap-1.5 text-muted"><span className="h-1.5 w-1.5 rounded-full bg-teal" /> Healthy</span>
                <span className="inline-flex items-center gap-1.5 text-muted ml-3"><span className="h-1.5 w-1.5 rounded-full bg-gold" /> Watch</span>
                <span className="inline-flex items-center gap-1.5 text-muted ml-3"><span className="h-1.5 w-1.5 rounded-full bg-coral" /> Critical</span>
              </div>
            </div>
            <div className="px-2 pb-2">
              <PortfolioBarChart companies={companiesForArrChart} />
            </div>
          </div>

          {/* Watch list */}
          <div className="lg:col-span-1">
            <WatchList items={watchList} />
          </div>
        </div>

        {/* Trend + activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-xl border border-line shadow-card overflow-hidden">
            <div className="px-5 pt-4 pb-2 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-ink">{ts("dashboard.trend")}</h3>
                <p className="text-[11px] text-muted mt-0.5">{ts("dashboard.last_8q")}</p>
              </div>
              <div className="text-[11px] text-muted">{ts("dashboard.live_caption")}</div>
            </div>
            <div className="px-2 pb-2">
              <ArrTrendChart data={arrTrend} />
            </div>
          </div>
          <div className="lg:col-span-1">
            <ActivityFeed />
          </div>
        </div>

        {/* L.6c — More fund-level visualizations: cash, burn, runway, headcount */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Cash on hand by company" subtitle="Latest period · USD millions">
            <PortfolioMetricBarChart companies={companies as any} metric="cash" units="millions" />
          </ChartCard>
          <ChartCard title="Monthly burn by company" subtitle="Latest period · USD thousands per month">
            <PortfolioMetricBarChart companies={companies as any} metric="burn" units="k_per_month" />
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChartCard title="Runway distribution" subtitle="Number of companies per runway bucket" colSpan={1}>
            <RunwayDistribution companies={companies as any} />
          </ChartCard>
          <ChartCard title="Aggregate headcount over time" subtitle="Sum across the active portfolio" colSpan={1}>
            <PortfolioTrendChart data={headcountTrend.map((p) => ({ label: p.quarter, value: p.value }))} units="raw" />
          </ChartCard>
          <ChartCard title="Aggregate cash over time" subtitle="Sum across the active portfolio" colSpan={1}>
            <PortfolioTrendChart data={cashTrend.map((p) => ({ label: p.quarter, value: p.value }))} units="millions" />
          </ChartCard>
        </div>

        {/* Newsletter — latest narrative updates from the portfolio */}
        <PortfolioNewsletter updates={updates} />
      </div>
    </>
  );
}

function ChartCard({
  title, subtitle, children, colSpan,
}: { title: string; subtitle?: string; children: React.ReactNode; colSpan?: 1 | 2 | 3 }) {
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
