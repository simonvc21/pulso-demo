import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, ExternalLink, Sparkles, FileText, MessageSquare, Pencil } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { TopbarBell } from "@/components/topbar-bell";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompanyHistoryChart } from "@/components/company-history-chart";
import { PortfolioNewsletter } from "@/components/portfolio-newsletter";
import { getCompanyBySlug, getNewsletterUpdates, type DashboardMetric } from "@/lib/dashboard-data";
import { fmtUSD, fmtPct, fmtNum } from "@/lib/utils";

export const dynamic = "force-dynamic";

const countryFlag: Record<string, string> = {
  MX: "🇲🇽", BR: "🇧🇷", CO: "🇨🇴", CL: "🇨🇱", AR: "🇦🇷", PE: "🇵🇪",
};

export default async function CompanyDetailPage({ params }: { params: { slug: string } }) {
  const [company, updates] = await Promise.all([
    getCompanyBySlug(params.slug),
    getNewsletterUpdates(20, { companySlug: params.slug }),
  ]);
  if (!company) return notFound();

  const last = company.metrics[company.metrics.length - 1];
  const prev = company.metrics[company.metrics.length - 2];
  const yoy = company.metrics[company.metrics.length - 5] || company.metrics[0];

  if (!last) return notFound();

  const arrQoQ = prev && prev.arr > 0 ? ((last.arr - prev.arr) / prev.arr) * 100 : 0;
  const arrYoY = yoy && yoy.arr > 0 ? ((last.arr - yoy.arr) / yoy.arr) * 100 : 0;
  const runway = last.burn > 0 ? last.cash / last.burn : 0;
  const burnQoQ = prev && prev.burn > 0 ? ((last.burn - prev.burn) / prev.burn) * 100 : 0;

  const aiInsight =
    company.status === "critical"
      ? `Runway is now ${runway.toFixed(1)} months — below the 9-month threshold you set. Recommend opening a bridge conversation in the next 14 days.`
      : company.status === "watch"
      ? `Burn jumped ${burnQoQ.toFixed(0)}% QoQ. ARR growth is decelerating relative to plan — worth a check-in before next quarter close.`
      : `On track. ARR ${fmtPct(arrQoQ, 1)} QoQ, ${fmtPct(arrYoY, 0)} YoY. No anomalies detected in the latest submission.`;

  return (
    <>
      <Topbar
        bell={<TopbarBell />}
        title={`${company.name}`}
        breadcrumb={
          <Link href="/companies" className="inline-flex items-center gap-1 hover:text-ink transition-colors">
            <ArrowLeft className="h-3 w-3" /> Companies
          </Link>
        }
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/companies/${company.slug}/edit`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            </Link>
            {company.founder.email ? (
              <a href={`mailto:${company.founder.email}?subject=${encodeURIComponent(`${company.name} — quick check-in`)}`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> Email founder
                </Button>
              </a>
            ) : (
              <Button variant="outline" size="sm" className="gap-1.5" disabled>
                <Mail className="h-3.5 w-3.5" /> No founder email
              </Button>
            )}
            <Link href={`/forms?company=${company.slug}`}>
              <Button variant="primary" size="sm" className="gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Send a form
              </Button>
            </Link>
          </div>
        }
      />

      <div className="px-8 py-6 space-y-6 animate-fade-in">
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
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-muted tracking-[0.14em] uppercase font-semibold">Founder</div>
              <div className="text-sm font-semibold text-ink mt-1">{company.founder.name}</div>
              <div className="text-[11px] text-muted">{company.founder.role}</div>
              {company.founder.email && (
                <a href={`mailto:${company.founder.email}`} className="text-[11px] text-teal-600 hover:underline inline-flex items-center gap-1 mt-0.5">
                  {company.founder.email} <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Stat label="Invested" value={fmtUSD(company.invested, { compact: true })} hint={`${company.ownership.toFixed(1)}% ownership`} />
          <Stat label="ARR" value={fmtUSD(last.arr, { compact: true })} delta={fmtPct(arrQoQ, 1)} positive={arrQoQ >= 0} hintLabel="QoQ" />
          <Stat label="Cash" value={fmtUSD(last.cash, { compact: true })} hint={`${runway.toFixed(1)} mo runway`} negative={runway < 9} />
          <Stat label="Monthly Burn" value={fmtUSD(last.burn, { compact: true })} delta={fmtPct(burnQoQ, 0)} positive={burnQoQ < 0} hintLabel="QoQ" />
          <Stat label="Headcount" value={fmtNum(last.headcount)} hint="FTE" />
          <Stat label="ARR (YoY)" value={fmtPct(arrYoY, 0)} hint={yoy ? `vs ${yoy.quarter}` : ""} positive={arrYoY > 0} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="ARR" subtitle="Last 8 quarters · USD millions" metrics={company.metrics} metric="arr" color="#14B8A6" />
          <ChartCard title="Cash on hand" subtitle="Trailing balance" metrics={company.metrics} metric="cash" color="#0A1F44" />
          <ChartCard title="Quarterly revenue" subtitle="Recognized" metrics={company.metrics} metric="revenue" color="#F4B740" />
          <ChartCard title="Headcount" subtitle="Full-time equivalents" metrics={company.metrics} metric="headcount" color="#1B3A6F" />
        </div>

        {/* Recent submissions — placeholder until form_submissions is wired */}
        <div className="bg-white rounded-xl border border-line shadow-card overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-line flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-ink">Recent submissions</h3>
              <p className="text-[11px] text-muted mt-0.5">Founder responses from the last 90 days</p>
            </div>
            <Link href="/forms">
              <Button variant="outline" size="sm" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> View all forms</Button>
            </Link>
          </div>
          <div className="divide-y divide-line">
            {[
              { date: "Apr 28, 2026", form: "Monthly Pulse Check", status: "Submitted", note: "Hiring 3 SDRs in May" },
              { date: "Apr 5, 2026",  form: "Q1 2026 Financials",  status: "Submitted", note: company.status === "critical" ? "Bridge conversation flagged" : "Auto-validated by Pulso AI" },
              { date: "Mar 28, 2026", form: "Monthly Pulse Check", status: "Submitted", note: "" },
              { date: "Feb 28, 2026", form: "Monthly Pulse Check", status: "Submitted", note: "" },
            ].map((r, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-4">
                <div className="h-8 w-8 rounded-lg bg-paper2 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink">{r.form}</div>
                  {r.note && <div className="text-[11px] text-muted mt-0.5 flex items-center gap-1.5"><MessageSquare className="h-3 w-3" />{r.note}</div>}
                </div>
                <Badge tone="teal">{r.status}</Badge>
                <div className="text-[11px] text-muted w-24 text-right">{r.date}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Newsletter — narrative updates from this company */}
        <PortfolioNewsletter updates={updates} />
      </div>
    </>
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
