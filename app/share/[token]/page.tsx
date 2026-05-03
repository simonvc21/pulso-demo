import { Lock, Download, Eye, Calendar, Sparkles, Zap } from "lucide-react";
import { fmtUSD, fmtPct } from "@/lib/utils";
import { ArrTrendChart } from "@/components/arr-trend-chart";
import { getShareLetter } from "@/lib/dashboard-data";
import { PreviewBackBar } from "@/components/preview-back-bar";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { token: string };
  searchParams: { preview?: string };
}

export default async function LpSharePage({ params, searchParams }: PageProps) {
  const result = await getShareLetter(params.token);
  const isPreview = searchParams?.preview === "1";

  if (result.kind === "expired") {
    return <ExpiredView />;
  }
  if (result.kind === "not_found") {
    return <NotFoundView />;
  }

  const { organization: org, share, companies } = result.data;
  const watermark = share.watermark_email ?? "view-only";

  // Aggregate KPIs across the portfolio
  const latest = (cms: typeof companies[number]["metrics"]) => cms[cms.length - 1];
  const prev = (cms: typeof companies[number]["metrics"]) => cms[cms.length - 2];
  const yoy = (cms: typeof companies[number]["metrics"]) => cms[cms.length - 5];

  const arrTotal = companies.reduce((a, c) => a + (latest(c.metrics)?.arr ?? 0), 0);
  const arrPrev = companies.reduce((a, c) => a + (prev(c.metrics)?.arr ?? 0), 0);
  const arrYoY = companies.reduce((a, c) => a + (yoy(c.metrics)?.arr ?? 0), 0);
  const qoqArrGrowth = arrPrev > 0 ? ((arrTotal - arrPrev) / arrPrev) * 100 : 0;
  const yoyGrowth = arrYoY > 0 ? ((arrTotal - arrYoY) / arrYoY) * 100 : 0;

  const arrTrend = (() => {
    const buckets = new Map<string, number>();
    for (const c of companies) {
      for (const m of c.metrics) buckets.set(m.quarter, (buckets.get(m.quarter) ?? 0) + m.arr);
    }
    return Array.from(buckets.entries()).map(([quarter, arr]) => ({ quarter, arr }));
  })();

  const topMovers = companies
    .filter((c) => c.status !== "critical")
    .map((c) => {
      const last = latest(c.metrics);
      const p = prev(c.metrics);
      const qoq = p && p.arr > 0 ? ((last.arr - p.arr) / p.arr) * 100 : 0;
      return { name: c.name, sector: c.sector, country: c.country, qoq, arr: last?.arr ?? 0 };
    })
    .sort((a, b) => b.qoq - a.qoq)
    .slice(0, 4);

  const fundSize = org.size_usd;
  const fundDeployed = org.deployed_usd;
  const deployedPct = fundSize > 0 ? Math.round((fundDeployed / fundSize) * 100) : 0;
  const expiresLabel = share.expires_at
    ? new Date(share.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;

  return (
    <div className="min-h-screen bg-paper relative">
      {isPreview && (
        <PreviewBackBar backHref="/lps" label={`LP letter as ${watermark}`} />
      )}
      {/* Watermark overlay */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-[0.04] select-none">
        <div className="absolute inset-0 flex flex-wrap content-around justify-around -rotate-12">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="text-3xl font-serif font-bold text-navy whitespace-nowrap mx-8 my-6">
              CONFIDENTIAL · {watermark} · {org.name}
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
                <div className="text-base font-serif font-bold text-ink leading-tight">{org.name}</div>
                <div className="text-[11px] text-muted">Quarterly letter · prepared for {watermark}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted bg-paper2 px-2.5 py-1 rounded-md">
                <Lock className="h-3 w-3" /> View-only{expiresLabel ? ` · expires ${expiresLabel}` : ""}
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
              <div className="text-[10px] tracking-[0.18em] uppercase font-semibold text-gold">LP Letter</div>
              <h1 className="mt-2 font-serif text-3xl font-bold leading-tight">
                {org.name} — Quarterly portfolio update
              </h1>
              <p className="mt-3 text-sm text-white/80 max-w-2xl">
                The portfolio finished the quarter in strong shape. Total ARR is {fmtPct(qoqArrGrowth, 1)} QoQ across {companies.length} companies. Below is the pulse of the fund.
              </p>
            </div>
            <div className="px-8 py-5 grid grid-cols-2 md:grid-cols-4 gap-4">
              <SimpleStat label="Total Invested" value={fmtUSD(fundDeployed, { compact: true })} hint={`${deployedPct}% of fund deployed`} />
              <SimpleStat label="Portfolio ARR" value={fmtUSD(arrTotal, { compact: true })} hint={`${fmtPct(qoqArrGrowth, 1)} QoQ`} positive />
              <SimpleStat label="Companies" value={String(companies.length)} hint={org.vintage ? `Vintage ${org.vintage}` : ""} />
              <SimpleStat label="Avg ARR Growth (YoY)" value={`${yoyGrowth.toFixed(0)}%`} hint="weighted, top quartile" positive />
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

          {/* Fund thesis (only when set) */}
          {org.thesis && (
            <div className="bg-white rounded-2xl shadow-card border border-line overflow-hidden">
              <div className="px-8 py-6">
                <div className="text-[10px] font-semibold tracking-[0.18em] uppercase text-gold-600">Our thesis</div>
                <h2 className="mt-1 text-lg font-serif font-bold text-ink">What we invest in</h2>
                <p className="mt-3 text-[13.5px] text-ink leading-relaxed whitespace-pre-line">{org.thesis}</p>
              </div>
            </div>
          )}

          {/* GP commentary */}
          <div className="bg-white rounded-2xl shadow-card border border-line overflow-hidden">
            <div className="px-8 py-6">
              <h2 className="text-lg font-serif font-bold text-ink">Letter from the GP</h2>
              <div className="mt-4 prose prose-sm max-w-none text-ink leading-relaxed space-y-3">
                <p className="text-[13.5px]">
                  This was, on balance, a strong quarter. ARR is at <strong>{fmtUSD(arrTotal, { compact: true })}</strong> across the portfolio with a <strong>{fmtPct(qoqArrGrowth, 1)} QoQ</strong> growth rate. Top performers continue to be well-capitalized for next-stage conversations later this year.
                </p>
                <p className="text-[13.5px]">
                  We are working closely with the founders of companies on our active monitoring list. We will share specifics privately on our next quarterly call.
                </p>
                <p className="text-[13.5px]">
                  Both new investments closed this quarter fit our thesis of LATAM-native infrastructure for the SMB economy.
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
                      <div className="text-[11px] text-muted">{c.sector ?? "—"} · {c.country ?? "—"}</div>
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
                {org.name} returned strong results with portfolio ARR up {fmtPct(qoqArrGrowth, 1)} QoQ and {yoyGrowth.toFixed(0)}% YoY. The fund is {deployedPct}% deployed across {companies.length} companies. The flagged companies receive active GP support; the rest are tracking ahead of plan.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 pb-12 flex items-center justify-between text-[11px] text-muted border-t border-line">
            <div className="flex items-center gap-2">
              <Calendar className="h-3 w-3" /> Auto-updates as new founder data arrives · {share.view_count} view{share.view_count === 1 ? "" : "s"}
            </div>
            <div>
              Powered by <span className="font-semibold text-navy">Pulso</span>
            </div>
          </div>
        </div>
      </div>
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

function ExpiredView() {
  return (
    <CenteredMessage
      tone="muted"
      title="This link has expired"
      body="Reach out to the GP to request a new share link."
    />
  );
}

function NotFoundView() {
  return (
    <CenteredMessage
      tone="muted"
      title="Letter not found"
      body="The link may be incorrect, revoked, or already replaced by a newer letter."
    />
  );
}

function CenteredMessage({ title, body }: { title: string; body: string; tone: "muted" }) {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-6">
      <div className="bg-white border border-line rounded-2xl shadow-card max-w-md w-full p-8 text-center">
        <div className="h-10 w-10 rounded-full bg-navy text-gold flex items-center justify-center mx-auto">
          <Lock className="h-5 w-5" />
        </div>
        <h1 className="mt-4 text-xl font-serif font-bold text-ink">{title}</h1>
        <p className="mt-2 text-sm text-muted">{body}</p>
      </div>
    </div>
  );
}
