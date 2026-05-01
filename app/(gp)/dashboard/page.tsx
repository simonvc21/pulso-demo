import Link from "next/link";
import { Download, Share2, Sparkles } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { KpiCard } from "@/components/kpi-card";
import { PortfolioBarChart } from "@/components/portfolio-bar-chart";
import { ArrTrendChart } from "@/components/arr-trend-chart";
import { WatchList } from "@/components/watch-list";
import { ActivityFeed } from "@/components/activity-feed";
import { Button } from "@/components/ui/button";
import { fund, fundKpis, companies } from "@/lib/mock-data";
import { fmtUSD } from "@/lib/utils";

export default function DashboardPage() {
  const k = fundKpis();
  const newThisQ = 2;

  return (
    <>
      <Topbar
        title="Overview"
        breadcrumb={`${fund.name} · Q1 2026`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            <Link href="/share/q1-2026-lp-letter">
              <Button variant="gold" size="sm" className="gap-1.5">
                <Share2 className="h-3.5 w-3.5" /> Share with LPs
              </Button>
            </Link>
          </div>
        }
      />

      <div className="px-8 py-6 space-y-6 animate-fade-in">
        {/* AI insight banner */}
        <div className="bg-gradient-to-r from-navy to-navy-700 rounded-xl p-4 flex items-start gap-3 text-white">
          <div className="h-8 w-8 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-gold font-semibold tracking-[0.16em] uppercase">Pulso AI · This week</div>
            <div className="text-sm mt-1 leading-relaxed">
              Portfolio ARR grew <span className="font-semibold text-teal">+8.2% QoQ</span>, driven by Vextra and Lumen. <span className="text-gold">2 companies</span> now have less than 12 months of runway — Brio is the most pressing.
            </div>
          </div>
          <button className="text-[11px] text-white/70 hover:text-white">Dismiss</button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total Invested"
            value={fmtUSD(fund.deployed, { compact: true })}
            delta={{ text: "+ $4.1M QoQ", trend: "up" }}
            hint="60% deployed"
          />
          <KpiCard
            label="Portfolio ARR"
            value={fmtUSD(k.arrTotal, { compact: true })}
            delta={{ text: `${k.qoqArrGrowth >= 0 ? "+" : ""}${k.qoqArrGrowth.toFixed(1)}% QoQ`, trend: k.qoqArrGrowth >= 0 ? "up" : "down" }}
            hint={`${newThisQ} new this Q`}
          />
          <KpiCard
            label="Avg ARR Growth (YoY)"
            value={`${k.yoyGrowth.toFixed(0)}%`}
            delta={{ text: "Top quartile", trend: "up" }}
            hint="weighted by ARR"
          />
          <KpiCard
            label="Portfolio Runway"
            value={`${k.runwayMonths.toFixed(1)} mo`}
            delta={{ text: "− 1.8 mo QoQ", trend: "down" }}
            hint={`${fmtUSD(k.cash, { compact: true })} cash`}
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* ARR by company (bar chart) */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-line shadow-card overflow-hidden">
            <div className="px-5 pt-4 pb-2 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-ink">Portfolio ARR by company</h3>
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

          {/* Watch list */}
          <div className="lg:col-span-1">
            <WatchList />
          </div>
        </div>

        {/* Trend + activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-xl border border-line shadow-card overflow-hidden">
            <div className="px-5 pt-4 pb-2 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-ink">Total portfolio ARR trend</h3>
                <p className="text-[11px] text-muted mt-0.5">Last 8 quarters</p>
              </div>
              <div className="text-[11px] text-muted">Live · pulled from founder submissions</div>
            </div>
            <div className="px-2 pb-2">
              <ArrTrendChart />
            </div>
          </div>
          <div className="lg:col-span-1">
            <ActivityFeed />
          </div>
        </div>
      </div>
    </>
  );
}
