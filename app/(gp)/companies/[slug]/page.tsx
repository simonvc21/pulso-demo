import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, ExternalLink, Sparkles, FileText, MessageSquare, Pencil, Globe, Linkedin } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { TopbarBell } from "@/components/topbar-bell";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompanyHistoryChart } from "@/components/company-history-chart";
import { PortfolioNewsletter } from "@/components/portfolio-newsletter";
import { getCompanyBySlug, getCompanyCustomMetrics, getCompanyUpdates, getNewsletterUpdates, type DashboardMetric, type CustomMetricSeries, type CustomMetricType } from "@/lib/dashboard-data";
import { UpdatesFeed } from "./updates-feed";
import { CommentsThread, ReactionsBar } from "@/components/lp-engagement";
import { getCompanyComments, getCompanyReactions } from "@/lib/lp-engagement";
import { ActiveFormWidget } from "./active-form-widget";
import { SectionTabs } from "./section-tabs";
import { getActiveFormForCompany } from "@/lib/active-form";
import { listCompanyFillTokens } from "@/lib/fill-tokens";
import { fmtUSD, fmtPct, fmtNum } from "@/lib/utils";
import { ts } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { CompanyHistoryChart as _ChartShape } from "@/components/company-history-chart";
import { CustomMetricChart } from "@/components/custom-metric-chart";

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

export default async function CompanyDetailPage({ params }: { params: { slug: string } }) {
  const [company, updates] = await Promise.all([
    getCompanyBySlug(params.slug),
    getNewsletterUpdates(20, { companySlug: params.slug }),
  ]);
  if (!company) return notFound();

  // Custom metrics need the canonical company id (CompanyDetail exposes slug only).
  const supabase = createClient();
  const { data: companyRow } = await supabase
    .from("companies")
    .select("id")
    .eq("slug", params.slug)
    .maybeSingle();
  const customMetrics = companyRow ? await getCompanyCustomMetrics(companyRow.id) : [];
  const teamUpdates = companyRow ? await getCompanyUpdates(companyRow.id, 50) : [];
  const [comments, reactions, activeForm, fillTokens] = companyRow
    ? await Promise.all([
        getCompanyComments(companyRow.id),
        getCompanyReactions(companyRow.id),
        getActiveFormForCompany(companyRow.id),
        listCompanyFillTokens(companyRow.id),
      ])
    : [[], [], null, []];

  // L.11 — list of forms in this org so the "Send extra" picker can show them.
  const { data: formOptions } = await supabase
    .from("forms")
    .select("slug, name")
    .eq("active", true)
    .order("name");

  // Resolve current user's id (for delete-own-comment + canModerate logic).
  const { data: { user: authUser } } = await supabase.auth.getUser();
  let currentUserId: string | null = null;
  let currentUserRole: string | null = null;
  if (authUser) {
    const { data: profile } = await supabase
      .from("users")
      .select("id, role")
      .eq("auth_user_id", authUser.id)
      .maybeSingle();
    currentUserId = profile?.id ?? null;
    currentUserRole = profile?.role ?? null;
  }
  const canModerate = ["gp", "managing_partner", "partner"].includes(currentUserRole ?? "");

  const last = company.metrics[company.metrics.length - 1];
  const prev = company.metrics[company.metrics.length - 2];
  const yoy = company.metrics[company.metrics.length - 5] || company.metrics[0];

  if (!last) return notFound();

  const arrMoM = prev && prev.arr > 0 ? ((last.arr - prev.arr) / prev.arr) * 100 : 0;
  const arrYoY = yoy && yoy.arr > 0 ? ((last.arr - yoy.arr) / yoy.arr) * 100 : 0;
  const runway = last.burn > 0 ? last.cash / last.burn : 0;
  const burnMoM = prev && prev.burn > 0 ? ((last.burn - prev.burn) / prev.burn) * 100 : 0;

  const aiInsight =
    company.status === "critical"
      ? `Runway is now ${runway.toFixed(1)} months — below the 9-month threshold you set. Recommend opening a bridge conversation in the next 14 days.`
      : company.status === "watch"
      ? `Burn jumped ${burnMoM.toFixed(0)}% MoM. ARR growth is decelerating relative to plan — worth a check-in before next quarter close.`
      : `On track. ARR ${fmtPct(arrMoM, 1)} MoM, ${fmtPct(arrYoY, 0)} YoY. No anomalies detected in the latest submission.`;

  return (
    <>
      <Topbar
        bell={<TopbarBell />}
        title={`${company.name}`}
        breadcrumb={
          <Link href="/companies" className="inline-flex items-center gap-1 hover:text-ink transition-colors">
            <ArrowLeft className="h-3 w-3" /> {ts("companies.back_to_companies")}
          </Link>
        }
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/companies/${company.slug}/edit`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Pencil className="h-3.5 w-3.5" /> {ts("companies.edit")}
              </Button>
            </Link>
            {company.founder.email ? (
              <a href={`mailto:${company.founder.email}?subject=${encodeURIComponent(`${company.name} — quick check-in`)}`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> {ts("companies.email_founder")}
                </Button>
              </a>
            ) : (
              <Button variant="outline" size="sm" className="gap-1.5" disabled>
                <Mail className="h-3.5 w-3.5" /> {ts("companies.no_founder_email")}
              </Button>
            )}
            <Link href={`/forms?company=${company.slug}`}>
              <Button variant="primary" size="sm" className="gap-1.5">
                <FileText className="h-3.5 w-3.5" /> {ts("companies.send_form")}
              </Button>
            </Link>
          </div>
        }
      />

      <div className="px-8 py-6 space-y-6 animate-fade-in">
        {company.archivedAt && (
          <div className="bg-coral/10 border border-coral/30 text-coral rounded-xl px-4 py-2.5 flex items-center gap-3 text-sm">
            <span className="font-semibold">Archived</span>
            <span className="text-coral/80 text-[12px]">
              This company is hidden from dashboards and pickers. Restore it from{" "}
              <Link href={`/companies/${company.slug}/edit`} className="underline">the edit page</Link>.
            </span>
          </div>
        )}
        {/* Hero */}
        <div className="bg-white rounded-xl border border-line shadow-card p-6">
          <div className="flex items-start gap-5">
            {company.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={company.logoUrl}
                alt={company.name}
                data-keep-white="true"
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
                {company.investmentInstrument && (company.safeCapUsd != null || company.safeDiscountPct != null) && (
                  <span className="text-[11px] text-muted">
                    {company.safeCapUsd != null && <span>cap {fmtUSD(company.safeCapUsd, { compact: true })}</span>}
                    {company.safeCapUsd != null && company.safeDiscountPct != null && <span> · </span>}
                    {company.safeDiscountPct != null && <span>{company.safeDiscountPct}% disc.</span>}
                  </span>
                )}
                {company.website && (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-teal"
                    aria-label="Website"
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
                    aria-label="LinkedIn"
                  >
                    <Linkedin className="h-3 w-3" /> LinkedIn
                  </a>
                )}
              </div>
              {/* L.22 — reactions bar under the badges */}
              {companyRow && (
                <div className="mt-3">
                  <ReactionsBar companyId={companyRow.id} initial={reactions} />
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-[10px] text-muted tracking-[0.14em] uppercase font-semibold">{ts("companies.founder")}</div>
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
                  <div className="text-[10px] text-gold font-semibold tracking-[0.16em] uppercase">{ts("companies.ai_insight")}</div>
                  <div className="text-[13px] mt-1 leading-relaxed">{aiInsight}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* L.11 — Active form widget (status badge + Send extra button) */}
        {companyRow && (
          <ActiveFormWidget
            companyId={companyRow.id}
            companySlug={company.slug}
            initial={activeForm}
            formOptions={(formOptions ?? []) as { slug: string; name: string }[]}
            fillTokens={fillTokens}
          />
        )}

        {/* KPI grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Stat label="Invested" value={fmtUSD(company.invested, { compact: true })} hint={`${company.ownership.toFixed(1)}% ownership`} />
          <Stat label="ARR" value={fmtUSD(last.arr, { compact: true })} delta={fmtPct(arrMoM, 1)} positive={arrMoM >= 0} hintLabel="MoM" />
          <Stat label="Cash" value={fmtUSD(last.cash, { compact: true })} hint={`${runway.toFixed(1)} mo runway`} negative={runway < 9} />
          <Stat label="Monthly Burn" value={fmtUSD(last.burn, { compact: true })} delta={fmtPct(burnMoM, 0)} positive={burnMoM < 0} hintLabel="MoM" />
          <Stat label="Headcount" value={fmtNum(last.headcount)} hint="FTE" />
          <Stat label="ARR (YoY)" value={fmtPct(arrYoY, 0)} hint={yoy ? `vs ${yoy.quarter}` : ""} positive={arrYoY > 0} />
        </div>

        {/* L.4b — Tabbed sections so 10+ charts don't become a wall of scroll */}
        <SectionTabs
          tabs={[
            {
              id: "financials",
              label: "Financials",
              content: (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <ChartCard title="ARR" subtitle="Last 8 quarters · USD millions" metrics={company.metrics} metric="arr" color="#14B8A6" />
                  <ChartCard title="Cash on hand" subtitle="Trailing balance" metrics={company.metrics} metric="cash" color="#0A1F44" />
                  <ChartCard title="Quarterly revenue" subtitle="Recognized" metrics={company.metrics} metric="revenue" color="#F4B740" />
                  <ChartCard title="Headcount" subtitle="Full-time equivalents" metrics={company.metrics} metric="headcount" color="#1B3A6F" />
                </div>
              ),
            },
            {
              id: "custom",
              label: "Custom metrics",
              count: customMetrics.length,
              content: customMetrics.length > 0
                ? <CustomMetricsBlock series={customMetrics} />
                : <CustomMetricsEmpty />,
            },
            {
              id: "activity",
              label: "Activity",
              content: (
                <div className="space-y-4">
                  {companyRow && (
                    <UpdatesFeed companyId={companyRow.id} initial={teamUpdates} />
                  )}
                  {companyRow && (
                    <CommentsThread
                      companyId={companyRow.id}
                      initial={comments}
                      canModerate={canModerate}
                      currentUserId={currentUserId}
                    />
                  )}
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
                  <PortfolioNewsletter updates={updates} />
                </div>
              ),
            },
          ]}
        />
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

function formatCustomValue(v: number | null, type: CustomMetricType, unit: string | null): string {
  if (v == null) return "—";
  if (type === "currency") {
    return v >= 1_000_000
      ? `${(v / 1_000_000).toFixed(1)}M`
      : v >= 1000
      ? `${(v / 1000).toFixed(0)}K`
      : v.toLocaleString("en-US");
  }
  if (type === "percent") return `${v}%`;
  return `${v.toLocaleString("en-US")}${unit ? ` ${unit}` : ""}`;
}

const CUSTOM_COLORS = ["#14B8A6", "#F4B740", "#1B3A6F", "#0A1F44", "#E1654B", "#7c849a"];

function CustomMetricsEmpty() {
  return (
    <div className="bg-white rounded-xl border border-line shadow-card p-8 text-center">
      <div className="text-sm font-semibold text-ink">No custom metrics applied yet</div>
      <p className="text-[12px] text-muted mt-1 max-w-md mx-auto">
        Define metrics like NPS, GMV, or MAU once in your fund's metric library, then apply
        them to any company in one click.
      </p>
      <Link href="/settings/metrics" className="inline-block mt-3">
        <Button variant="gold" size="sm">Open metric library</Button>
      </Link>
    </div>
  );
}

function CustomMetricsBlock({ series }: { series: CustomMetricSeries[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-[10px] font-semibold text-muted tracking-[0.16em] uppercase">Custom metrics</h2>
        <span className="text-[11px] text-muted">{series.length} tracked</span>
      </div>

      {/* Stat strip: latest value + MoM delta */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {series.map((s) => {
          const delta = s.prev != null && s.prev !== 0
            ? ((Number(s.latest ?? 0) - Number(s.prev)) / Number(s.prev)) * 100
            : null;
          return (
            <div key={s.definition.id} className="bg-white rounded-xl border border-line p-3.5 shadow-card">
              <div className="text-[10px] font-semibold text-muted tracking-[0.14em] uppercase truncate">
                {s.definition.label}
              </div>
              <div className="mt-1 font-serif text-xl font-bold text-ink leading-none tabular-nums">
                {formatCustomValue(s.latest, s.definition.type, s.definition.unit)}
              </div>
              {delta != null && (
                <div className="mt-1.5 text-[11px]">
                  <span className={delta >= 0 ? "text-teal-600 font-medium" : "text-coral font-medium"}>
                    {delta >= 0 ? "+" : ""}{delta.toFixed(1)}%
                  </span>
                  <span className="text-muted"> MoM</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* One mini-chart per metric */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {series.map((s, i) => (
          <div key={s.definition.id} className="bg-white rounded-xl border border-line shadow-card overflow-hidden">
            <div className="px-5 pt-3 pb-1">
              <h3 className="text-sm font-semibold text-ink">{s.definition.label}</h3>
              <p className="text-[11px] text-muted mt-0.5">
                {s.definition.type}{s.definition.unit ? ` · ${s.definition.unit}` : ""} · {s.values.length} quarter{s.values.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="px-2 pb-3">
              <CustomMetricChart
                data={s.values}
                color={CUSTOM_COLORS[i % CUSTOM_COLORS.length]}
                unit={s.definition.unit}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
