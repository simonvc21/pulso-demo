"use client";

import { useState } from "react";
import { Lock, Download, Eye, Calendar, Sparkles, Zap } from "lucide-react";
import { fund, fundKpis, companies } from "@/lib/mock-data";
import { fmtUSD, fmtPct } from "@/lib/utils";
import { ArrTrendChart } from "@/components/arr-trend-chart";

// LP-side view — branded, watermarked, limited to what GPs share
export default function LpSharePage({ params }: { params: { token: string } }) {
  const k = fundKpis();
  const [showAuth, setShowAuth] = useState(false);

  // Aggregated quarterly ARR trend (sum across portfolio)
  const arrTrend = companies[0].metrics.map((m, i) => ({
    quarter: m.quarter,
    arr: companies.reduce((a, c) => a + c.metrics[i].arr, 0),
  }));

  // Aggregated, anonymized "top movers" for LPs (no critical company names)
  const topMovers = [...companies]
    .map((c) => {
      const last = c.metrics[c.metrics.length - 1];
      const prev = c.metrics[c.metrics.length - 2];
      return { name: c.name, sector: c.sector, country: c.country, qoq: ((last.arr - prev.arr) / prev.arr) * 100, arr: last.arr, status: c.status };
    })
    .filter((c) => c.status !== "critical") // GP chose to hide critical names from LPs
    .sort((a, b) => b.qoq - a.qoq)
    .slice(0, 4);

  return (
    <div className="min-h-screen bg-paper relative">
      {/* Watermark overlay */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-[0.04] select-none">
        <div className="absolute inset-0 flex flex-wrap content-around justify-around -rotate-12">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="text-3xl font-serif font-bold text-navy whitespace-nowrap mx-8 my-6">
              CONFIDENTIAL · andina@familyoffice.cl · {fund.name}
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="bg-white border-b border-line">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-navy flex items-center justify-center">
                <Zap className="h-4 w-4 text-gold" fill="currentColor" />
              </div>
              <div>
                <div className="text-base font-serif font-bold text-ink leading-tight">{fund.name}</div>
                <div className="text-[11px] text-muted">Q1 2026 quarterly letter · prepared for Andina Capital Partners</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted bg-paper2 px-2.5 py-1 rounded-md">
                <Lock className="h-3 w-3" /> View-only · expires May 30
              </span>
              <button className="h-9 px-3 rounded-lg border border-line bg-white text-xs font-medium text-ink hover:bg-paper2 inline-flex items-center gap-1.5">
                <Download className="h-3.5 w-3.5" /> PDF
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
          {/* Hero */}
          <div className="bg-white rounded-2xl shadow-card border border-line overflow-hidden">
            <div className="bg-navy text-white px-8 py-7">
              <div className="text-[10px] tracking-[0.18em] uppercase font-semibold text-gold">LP Letter · Q1 2026</div>
              <h1 className="mt-2 font-serif text-3xl font-bold leading-tight">
                Patagonia Fund I — Quarterly portfolio update
              </h1>
              <p className="mt-3 text-sm text-white/80 max-w-2xl">
                Dear Andina team — the portfolio finished Q1 in strong shape. Total ARR is up {k.qoqArrGrowth.toFixed(1)}% QoQ, with two new investments this quarter. Below is the pulse of the fund as of April 30, 2026.
              </p>
            </div>
            <div className="px-8 py-5 grid grid-cols-2 md:grid-cols-4 gap-4">
              <SimpleStat label="Total Invested" value={fmtUSD(fund.deployed, { compact: true })} hint={`${((fund.deployed / fund.size) * 100).toFixed(0)}% of fund deployed`} />
              <SimpleStat label="Portfolio ARR" value={fmtUSD(k.arrTotal, { compact: true })} hint={`${fmtPct(k.qoqArrGrowth, 1)} QoQ`} positive />
              <SimpleStat label="Companies" value={String(fund.companies)} hint="2 new in Q1" />
              <SimpleStat label="Avg ARR Growth (YoY)" value={`${k.yoyGrowth.toFixed(0)}%`} hint="weighted, top quartile" positive />
            </div>
          </div>

          {/* Trend */}
          <div className="bg-white rounded-2xl shadow-card border border-line overflow-hidden">
            <div className="px-8 pt-6 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-serif font-bold text-ink">Portfolio ARR — last 8 quarters</h2>
                <p className="text-[12px] text-muted mt-0.5">USD millions, normalized across LATAM currencies</p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-teal-600 bg-teal-50 px-2.5 py-1 rounded-md font-medium">
                <Eye className="h-3 w-3" /> Live data
              </span>
            </div>
            <div className="px-4 pb-3"><ArrTrendChart data={arrTrend} /></div>
          </div>

          {/* GP commentary */}
          <div className="bg-white rounded-2xl shadow-card border border-line overflow-hidden">
            <div className="px-8 py-6">
              <h2 className="text-lg font-serif font-bold text-ink">Letter from the GP</h2>
              <div className="mt-4 prose prose-sm max-w-none text-ink leading-relaxed space-y-3">
                <p className="text-[13.5px]">
                  Q1 was, on balance, a strong quarter. ARR is at <strong>{fmtUSD(k.arrTotal, { compact: true })}</strong> across the portfolio with a <strong>{fmtPct(k.qoqArrGrowth, 1)} QoQ</strong> growth rate. Vextra (Mexico) and Lumen (Brazil) continue to be the standouts — both crossed important commercial milestones during the quarter and are well-capitalized for Series B conversations later this year.
                </p>
                <p className="text-[13.5px]">
                  Two of our companies are in active monitoring. We are working closely with one founder on a bridge plan to extend runway to 14 months. We will share specifics privately on our next quarterly call.
                </p>
                <p className="text-[13.5px]">
                  We deployed two new investments this quarter — one fintech (Mexico) and one logistics platform (Colombia). Both fit our thesis of LATAM-native infrastructure for the SMB economy.
                </p>
              </div>
            </div>
          </div>

          {/* Top movers */}
          <div className="bg-white rounded-2xl shadow-card border border-line overflow-hidden">
            <div className="px-8 pt-6 pb-2">
              <h2 className="text-lg font-serif font-bold text-ink">Highlighted companies</h2>
              <p className="text-[12px] text-muted mt-0.5">Top-line movers this quarter — names disclosed at GP discretion</p>
            </div>
            <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              {topMovers.map((c) => (
                <div key={c.name} className="border border-line rounded-xl p-4 bg-paper">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-navy flex items-center justify-center text-gold font-serif font-bold text-base">
                      {c.name[0]}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-ink">{c.name}</div>
                      <div className="text-[11px] text-muted">{c.sector} · {c.country}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-ink tabular-nums">{fmtUSD(c.arr, { compact: true })}</div>
                      <div className={`text-[11px] font-medium ${c.qoq >= 0 ? "text-teal-600" : "text-coral"} tabular-nums`}>{fmtPct(c.qoq, 1)} QoQ</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI summary card */}
          <div className="bg-gradient-to-r from-navy to-navy-700 rounded-2xl text-white p-6 flex items-start gap-4">
            <div className="h-10 w-10 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-gold" />
            </div>
            <div>
              <div className="text-[10px] text-gold tracking-[0.16em] uppercase font-semibold">Generated by Pulso</div>
              <h3 className="mt-1 text-base font-serif font-semibold">In one paragraph</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-white/90">
                Patagonia Fund I returned strong Q1 results with portfolio ARR up {fmtPct(k.qoqArrGrowth, 1)} QoQ and {k.yoyGrowth.toFixed(0)}% YoY. The fund is {((fund.deployed / fund.size) * 100).toFixed(0)}% deployed across {fund.companies} companies in 6 LATAM countries. Two companies require active GP support; six are tracking ahead of plan.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 pb-12 flex items-center justify-between text-[11px] text-muted border-t border-line">
            <div className="flex items-center gap-2">
              <Calendar className="h-3 w-3" /> Generated April 30, 2026 · auto-updates as new data arrives
            </div>
            <div>
              Powered by <span className="font-semibold text-navy">Pulso</span>
            </div>
          </div>
        </div>
      </div>

      {/* Soft auth prompt */}
      {showAuth && (
        <div className="fixed inset-0 z-50 bg-navy/40 flex items-center justify-center p-6" onClick={() => setShowAuth(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-semibold">Verify your identity</div>
            <div className="text-xs text-muted mt-1">Enter the code we sent to andina@familyoffice.cl</div>
          </div>
        </div>
      )}
    </div>
  );
}

function SimpleStat({ label, value, hint, positive }: { label: string; value: string; hint?: string; positive?: boolean }) {
  return (
    <div>
      <div className="text-[10px] tracking-[0.14em] uppercase text-muted font-semibold">{label}</div>
      <div className="mt-1 font-serif text-2xl font-bold text-ink leading-none tabular-nums">{value}</div>
      {hint && <div className={`text-[11px] mt-1 ${positive ? "text-teal-600 font-medium" : "text-muted"}`}>{hint}</div>}
    </div>
  );
}
