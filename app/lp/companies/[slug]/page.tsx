import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Sparkles, Globe, Linkedin } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { CompanyHistoryChart } from "@/components/company-history-chart";
import { PortfolioNewsletter } from "@/components/portfolio-newsletter";
import { getCompanyBySlug, getNewsletterUpdates, type DashboardMetric } from "@/lib/dashboard-data";
import { fmtUSD, fmtPct, fmtNum } from "@/lib/utils";

export const dynamic = "force-dynamic";

const countryFlag: Record<string, string> = {
  MX: "🇲🇽", BR: "🇧🇷", CO: "🇨🇴", CL: "🇨🇱", AR: "🇦🇷", PE: "🇵🇪",
};

const instrumentLabel: Record<string, string> = {
  safe: "SAFE",
  convertible_note: "Convertible Note",
  equity: "Equity",
  saft: "SAFT",
  warrant: "Warrant",
  loan: "Loan",
  other: "Other",
};

export default async function LpCompanyDetailPage({ params }: { params: { slug: string } }) {
  const [company, updates] = await Promise.all([
    getCompanyBySlug(params.slug),
    getNewsletterUpdates(20, { companySlug: params.slug }),
  ]);
  if (!company) notFound();

  const last = company.metrics[company.metrics.length - 1];
  const prev = company.metrics[company.metrics.length - 2];
  const yoy = company.metrics[company.metrics.length - 5] || company.metrics[0];
  if (!last) notFound();

  const arrQoQ = prev && prev.arr > 0 ? ((last.arr - prev.arr) / prev.arr) * 100 : 0;
  const arrYoY = yoy && yoy.arr > 0 ? ((last.arr - yoy.arr) / yoy.arr) * 100 : 0;
  const runway = last.burn > 0 ? last.cash / last.burn : 0;
  const burnQoQ = prev && prev.burn > 0 ? ((last.burn - prev.burn) / prev.burn) * 100 : 0;

  const aiInsight =
    company.status === "critical"
      ? `Runway is ${runway.toFixed(1)} months. The GP is actively engaged with the founder.`
      : company.status === "watch"
      ? `Burn moved ${burnQoQ.toFixed(0)}% QoQ; ARR growth is decelerating relative to plan.`
      : `On track. ARR ${fmtPct(arrQoQ, 1)} QoQ, ${fmtPct(arrYoY, 0)} YoY.`;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 animate-fade-in space-y-6">
      <Link href="/lp/companies" className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-ink">
        <ArrowLeft className="h-3 w-3" /> Back to portfolio
      </Link>

      {/* Hero */}
      <div className="bg-white rounded-xl border border-line shadow-card p-6">
        <div className="flex items-start gap-5">
          {company.logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={company.logoUrl}
              alt={company.name}
              className="h-14 w-14 rounded-xl object-contain bg-white border border-line shrink-0"
            />
          ) : (
            <div className="h-14 w-14 rounded-xl bg-navy flex items-center justify-center text-gold font-serif text-2xl font-bold shrink-0">
              {company.name[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-serif font-bold text-ink">{company.name}</h2>
              {company.country && <span className="text-base">{countryFlag[company.country] ?? ""}</span>}
              <StatusBadge status={company.status} />
            </div>
            {company.description && <p className="text-sm text-muted mt-1">{company.description}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {company.sector && <Badge>{company.sector}</Badge>}
              <Badge>{company.stage}</Badge>
              {company.country && <Badge>{company.country}</Badge>}
              {company.investmentInstrument && (
                <Badge tone="gold">{instrumentLabel[company.investmentInstrument] ?? company.investmentInstrument}</Badge>
              )}
              {company.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-teal"
                >
                  <Globe className="h-3 w-3" /> Website
                </a>
              )}
              {company.linkedinUrl && (
                <a
                  href={company.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-teal"
                >
                  <Linkedin className="h-3 w-3" /> LinkedIn
                </a>
              )}
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-[10px] text-muted tracking-[0.14em] uppercase font-semibold">Founder</div>
            <div className="text-sm font-semibold text-ink mt-1">{company.founder.name || "—"}</div>
            <div className="text-[11px] text-muted">{company.founder.role}</div>
          </div>
        </div>

        {company.flag && (
          <div className="mt-5 pt-5 border-t border-line">
            <div className="bg-gradient-to-r from-navy to-navy-700 rounded-lg p-3.5 text-white flex items-start gap-3">
              <div className="h-7 w-7 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
                <Sparkles className="h-3.5 w-3.5 text-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-gold font-semibold tracking-[0.16em] uppercase">Pulso AI insight</div>
                <div className="text-[13px] mt-1 leading-relaxed">{aiInsight}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Stat label="Invested" value={fmtUSD(company.invested, { compact: true })} hint={`${company.ownership.toFixed(1)}% ownership`} />
        <Stat label="ARR" value={fmtUSD(last.arr, { compact: true })} delta={fmtPct(arrQoQ, 1)} positive={arrQoQ >= 0} hintLabel="QoQ" />
        <Stat label="Cash" value={fmtUSD(last.cash, { compact: true })} hint={`${runway.toFixed(1)} mo runway`} negative={runway < 9} />
        <Stat label="Headcount" value={fmtNum(last.headcount)} hint="FTE" />
        <Stat label="ARR (YoY)" value={fmtPct(arrYoY, 0)} hint={yoy ? `vs ${yoy.quarter}` : ""} positive={arrYoY > 0} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="ARR" subtitle="Last 8 quarters · USD" metrics={company.metrics} metric="arr" color="#14B8A6" />
        <ChartCard title="Cash on hand" subtitle="Trailing balance" metrics={company.metrics} metric="cash" color="#0A1F44" />
        <ChartCard title="Quarterly revenue" subtitle="Recognized" metrics={company.metrics} metric="revenue" color="#F4B740" />
        <ChartCard title="Headcount" subtitle="Full-time equivalents" metrics={company.metrics} metric="headcount" color="#1B3A6F" />
      </div>

      {/* Newsletter — narrative updates */}
      <PortfolioNewsletter updates={updates} />

      <div className="text-[11px] text-muted text-center pt-4">
        Information sourced from founder submissions and shared by your GP.{" "}
        <a href="mailto:" className="text-teal-600 hover:underline inline-flex items-center gap-1">
          Question? Ask your GP <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>
    </div>
  );
}

function Stat({ label, value, delta, hint, hintLabel, positive, negative }: { label: string; value: string; delta?: string; hint?: string; hintLabel?: string; positive?: boolean; negative?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-line p-3.5 shadow-card">
      <div className="text-[10px] font-semibold text-muted tracking-[0.14em] uppercase">{label}</div>
      <div className="mt-1 font-serif text-xl font-bold text-ink leading-none tabular-nums">{value}</div>
      {(delta || hint) && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
          {delta && (
            <span className={positive ? "text-teal-600 font-medium" : negative ? "text-coral font-medium" : "text-muted"}>
              {delta}
            </span>
          )}
          {hintLabel && delta && <span className="text-muted">{hintLabel}</span>}
          {hint && <span className={negative ? "text-coral" : "text-muted"}>{hint}</span>}
        </div>
      )}
    </div>
  );
}

function ChartCard(props: { title: string; subtitle: string; metrics: DashboardMetric[]; metric: "arr" | "burn" | "cash" | "headcount" | "revenue"; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-line shadow-card overflow-hidden">
      <div className="px-5 pt-4 pb-2">
        <h3 className="text-sm font-semibold text-ink">{props.title}</h3>
        <p className="text-[11px] text-muted mt-0.5">{props.subtitle}</p>
      </div>
      <div className="px-2 pb-3">
        <CompanyHistoryChart metrics={props.metrics as any} metric={props.metric} color={props.color} />
      </div>
    </div>
  );
}
