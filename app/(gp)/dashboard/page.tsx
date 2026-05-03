import Link from "next/link";
import { Download, Share2 } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { TopbarBell } from "@/components/topbar-bell";
import { KpiCard } from "@/components/kpi-card";
import { PortfolioBarChart } from "@/components/portfolio-bar-chart";
import { ArrTrendChart } from "@/components/arr-trend-chart";
import { WatchList } from "@/components/watch-list";
import { ActivityFeed } from "@/components/activity-feed";
import { Button } from "@/components/ui/button";
import { fmtUSD } from "@/lib/utils";
import { getDashboardData, getNewsletterUpdates } from "@/lib/dashboard-data";
import { PortfolioNewsletter } from "@/components/portfolio-newsletter";
import { DashboardAIBanner } from "@/components/dashboard-ai-banner";
import { DashboardEditor } from "@/components/dashboard-editor";
import { ts } from "@/lib/i18n-server";
import type { DashboardWidgetId } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [{ organization, companies, kpis, arrTrend, watchList, dashboardConfig }, updates] = await Promise.all([
    getDashboardData(),
    getNewsletterUpdates(8),
  ]);

  const fundName = organization?.name ?? "Your fund";
  const fundSize = Number(organization?.size_usd ?? 0);
  const fundDeployed = Number(organization?.deployed_usd ?? 0);
  const deployedPct = fundSize > 0 ? Math.round((fundDeployed / fundSize) * 100) : 0;
  const newThisQ = 2;

  const slots: Record<DashboardWidgetId, React.ReactNode> = {
    ai_banner: (
      <DashboardAIBanner
        qoqGrowth={kpis.qoqArrGrowth}
        flaggedCount={watchList.length}
        label={ts("dashboard.ai_banner_label")}
      />
    ),
    kpis: (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label={ts("dashboard.kpi_total_invested")}
          value={fmtUSD(fundDeployed, { compact: true })}
          delta={{ text: "+ $4.1M QoQ", trend: "up" }}
          hint={`${deployedPct}% ${ts("dashboard.deployed")}`}
        />
        <KpiCard
          label={ts("dashboard.kpi_portfolio_arr")}
          value={fmtUSD(kpis.arrTotal, { compact: true })}
          delta={{ text: `${kpis.qoqArrGrowth >= 0 ? "+" : ""}${kpis.qoqArrGrowth.toFixed(1)}% QoQ`, trend: kpis.qoqArrGrowth >= 0 ? "up" : "down" }}
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
          delta={{ text: "− 1.8 mo QoQ", trend: "down" }}
          hint={`${fmtUSD(kpis.cash, { compact: true })} ${ts("dashboard.cash")}`}
        />
      </div>
    ),
    arr_by_company: (
      <div className="bg-white rounded-xl border border-line shadow-card overflow-hidden">
        <div className="px-5 pt-4 pb-2 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink">{ts("dashboard.arr_by_company")}</h3>
            <p className="text-[11px] text-muted mt-0.5">Q1 2026 · USD, normalized</p>
          </div>
          <div className="flex gap-1 text-[10px]">
            <span className="inline-flex items-center gap-1.5 text-muted"><span className="h-1.5 w-1.5 rounded-full bg-teal" /> Healthy</span>
            <span className="inline-flex items-center gap-1.5 text-muted ml-3"><span className="h-1.5 w-1.5 rounded-full bg-gold" /> Watch</span>
            <span className="inline-flex items-center gap-1.5 text-muted ml-3"><span className="h-1.5 w-1.5 rounded-full bg-coral" /> Critical</span>
          </div>
        </div>
        <div className="px-2 pb-2">
          <PortfolioBarChart companies={companies} />
        </div>
      </div>
    ),
    watch_list: <WatchList items={watchList} />,
    arr_trend: (
      <div className="bg-white rounded-xl border border-line shadow-card overflow-hidden">
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
    ),
    activity: <ActivityFeed />,
    newsletter: <PortfolioNewsletter updates={updates} />,
  };

  return (
    <>
      <Topbar
        bell={<TopbarBell />}
        title={ts("dashboard.title")}
        breadcrumb={`${fundName} · Q1 2026`}
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

      <DashboardEditor initialConfig={dashboardConfig} slots={slots} />
    </>
  );
}
