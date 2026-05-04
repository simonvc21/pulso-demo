// L.10 / Fase 1.D — Read-only fund dashboard. Summary KPIs + portfolio bar
// chart. Stays a server component so the public share route doesn't ship the
// auth-aware getDashboardData logic to the browser.

import { KpiCard } from "@/components/kpi-card";
import { PortfolioBarChart } from "@/components/portfolio-bar-chart";
import { ArrTrendChart } from "@/components/arr-trend-chart";
import { fmtMoney } from "@/lib/utils";
import { getDashboardData } from "@/lib/dashboard-data";
import { getLatestArrFromSheets } from "@/lib/sheets-arr";

export async function FundDashboardView() {
  const { organization, companies, kpis, arrTrend, watchList } = await getDashboardData();
  const sheetsArr = await getLatestArrFromSheets();
  const ccy = organization?.currency ?? "USD";

  // Same convention as the GP dashboard: prefer sheet ARR over legacy metrics.
  const companiesForChart = companies.map((c) => {
    const sheetArr = sheetsArr.get(c.id);
    if (sheetArr == null || c.metrics.length === 0) return c;
    const lastIdx = c.metrics.length - 1;
    const next = [...c.metrics];
    next[lastIdx] = { ...next[lastIdx], arr: sheetArr };
    return { ...c, metrics: next };
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Companies"
          value={String(companies.length)}
          hint={watchList.length > 0 ? `${watchList.length} on watch list` : "All on track"}
        />
        <KpiCard
          label="Portfolio ARR"
          value={fmtMoney(kpis.arrTotal, { compact: true }, ccy)}
          delta={{
            text: `${kpis.qoqArrGrowth >= 0 ? "+" : ""}${kpis.qoqArrGrowth.toFixed(1)}% MoM`,
            trend: kpis.qoqArrGrowth >= 0 ? "up" : "down",
          }}
        />
        <KpiCard
          label="YoY growth"
          value={`${kpis.yoyGrowth.toFixed(0)}%`}
          hint="weighted by ARR"
        />
        <KpiCard
          label="Avg runway"
          value={`${kpis.runwayMonths.toFixed(1)} mo`}
          hint={fmtMoney(kpis.cash, { compact: true }, ccy) + " cash"}
        />
      </div>

      <div className="bg-white rounded-xl border border-line shadow-card overflow-hidden">
        <div className="px-5 pt-4 pb-2">
          <h3 className="text-sm font-semibold text-ink">ARR by company</h3>
          <p className="text-[11px] text-muted mt-0.5">Latest period · USD, normalized</p>
        </div>
        <div className="px-2 pb-2">
          <PortfolioBarChart companies={companiesForChart} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-line shadow-card overflow-hidden">
        <div className="px-5 pt-4 pb-2">
          <h3 className="text-sm font-semibold text-ink">Aggregate ARR trend</h3>
          <p className="text-[11px] text-muted mt-0.5">Sum across the active portfolio</p>
        </div>
        <div className="px-2 pb-2">
          <ArrTrendChart data={arrTrend} />
        </div>
      </div>
    </div>
  );
}
