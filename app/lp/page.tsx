import Link from "next/link";
import { ChevronRight, FileText, Calendar, Eye, Briefcase, MessageSquare, BarChart3, TrendingUp } from "lucide-react";
import { getLpLetters, getCompanyList, getDashboardData } from "@/lib/dashboard-data";
import { listNewsletters } from "@/lib/newsletter";
import { fmtUSD, fmtPct } from "@/lib/utils";
import { ts } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function LpHomePage() {
  const [letters, companies, dashboard, newsletters] = await Promise.all([
    getLpLetters(),
    getCompanyList(),
    getDashboardData(),
    listNewsletters({ publishedOnly: true }),
  ]);
  const kpis = dashboard.kpis;
  const watchCount = dashboard.watchList.length;
  const latestNewsletter = newsletters[0] ?? null;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="text-[11px] font-semibold text-gold-600 tracking-[0.18em] uppercase">
        {ts("lp_portal.header")}
      </div>

      {/* L.6 — Fund-level KPI strip so the LP sees the headline numbers
          without leaving the home page. */}
      {companies.length > 0 && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiTile
            label="Portfolio ARR"
            value={fmtUSD(kpis.arrTotal, { compact: true })}
            delta={kpis.arrPrev > 0 ? fmtPct(kpis.qoqArrGrowth, 1) : null}
            positive={kpis.qoqArrGrowth >= 0}
            icon={TrendingUp}
          />
          <KpiTile label="Cash on hand" value={fmtUSD(kpis.cash, { compact: true })} />
          <KpiTile
            label="Avg runway"
            value={kpis.runwayMonths > 0 ? `${kpis.runwayMonths.toFixed(0)} mo` : "—"}
            negative={kpis.runwayMonths > 0 && kpis.runwayMonths < 9}
          />
          <KpiTile
            label="Watch list"
            value={String(watchCount)}
            negative={watchCount > 0}
          />
        </div>
      )}

      {/* Portfolio is the primary callout. */}
      {companies.length > 0 ? (
        <Link href="/lp/companies" className="block group mt-5">
          <div className="bg-gradient-to-r from-navy to-navy-700 text-white rounded-2xl p-6 flex items-center gap-5 hover:shadow-cardHover transition-shadow">
            <div className="h-12 w-12 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
              <Briefcase className="h-5 w-5 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] tracking-[0.18em] uppercase text-gold font-semibold">
                {ts("lp_portal.portfolio_callout_label")}
              </div>
              <h2 className="mt-1 text-xl font-serif font-bold">
                {ts("lp_portal.portfolio_callout_title", { n: companies.length })}
              </h2>
              <p className="text-[12px] text-white/70 mt-1">
                Live dashboards with ARR, cash, runway, and custom metrics for each company.
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-white/60 group-hover:text-gold transition-colors shrink-0" />
          </div>
        </Link>
      ) : (
        <div className="mt-3 bg-white rounded-2xl border border-line shadow-card p-6 text-center">
          <BarChart3 className="h-6 w-6 text-muted mx-auto" />
          <p className="text-[13px] text-muted mt-2">No portfolio companies yet — your GP will populate this soon.</p>
        </div>
      )}

      {/* Quick-jump grid: 3 most prominent companies. */}
      {companies.length > 0 && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {companies.slice(0, 3).map((c) => (
            <Link key={c.slug} href={`/lp/companies/${c.slug}`} className="group">
              <div className="bg-white rounded-xl border border-line shadow-card p-4 h-full hover:shadow-cardHover transition-shadow">
                <div className="flex items-center gap-2.5">
                  {c.logoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={c.logoUrl}
                      alt={c.name}
                      data-keep-white="true"
                      className="h-9 w-9 rounded-lg object-contain bg-white border border-line shrink-0"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-lg bg-navy flex items-center justify-center text-gold font-serif font-bold text-sm shrink-0">
                      {c.name[0]}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-ink truncate group-hover:underline underline-offset-2">{c.name}</div>
                    {c.sector && <div className="text-[10px] text-muted truncate">{c.sector}</div>}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted group-hover:text-teal-600 shrink-0" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      {companies.length > 3 && (
        <div className="mt-2 text-right">
          <Link href="/lp/companies" className="text-[11px] text-teal-600 hover:underline">
            View all {companies.length} companies →
          </Link>
        </div>
      )}

      {/* L.6 — Latest newsletter callout. Big card if one exists, link to all. */}
      {latestNewsletter ? (
        <Link href={`/lp/newsletters/${latestNewsletter.id}`} className="block group mt-6">
          <div className="bg-white rounded-2xl border border-line shadow-card p-5 flex items-center gap-4 hover:shadow-cardHover transition-shadow">
            <div className="h-10 w-10 rounded-full bg-gold/15 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-gold-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-semibold tracking-[0.18em] uppercase text-gold-600">
                Latest newsletter · {latestNewsletter.periodLabel}
              </div>
              <h2 className="mt-1 text-base font-serif font-semibold text-ink truncate">
                {latestNewsletter.coverTitle}
              </h2>
              {latestNewsletter.heroMetricSummary && (
                <p className="text-[11px] text-muted mt-0.5">{latestNewsletter.heroMetricSummary}</p>
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-muted group-hover:text-teal-600 shrink-0" />
          </div>
        </Link>
      ) : null}

      {/* Messages */}
      <Link href="/lp/messages" className="block group mt-4">
        <div className="bg-white rounded-2xl border border-line shadow-card p-5 flex items-center gap-4 hover:shadow-cardHover transition-shadow">
          <div className="h-10 w-10 rounded-full bg-teal-50 flex items-center justify-center shrink-0">
            <MessageSquare className="h-5 w-5 text-teal-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-serif font-semibold text-ink">Message your GP</h2>
            <p className="text-[12px] text-muted mt-0.5">Private 1-on-1 thread for questions, intros, deal flow.</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted group-hover:text-ink transition-colors shrink-0" />
        </div>
      </Link>

      {/* All newsletters + share-link letters section */}
      <div className="mt-10 flex items-center justify-between">
        <h3 className="text-[10px] font-semibold text-muted tracking-[0.18em] uppercase">
          {ts("lp_portal.letters_title")}
        </h3>
        {newsletters.length > 1 && (
          <Link href="/lp/newsletters" className="text-[11px] text-teal-600 hover:underline">
            All {newsletters.length} newsletters →
          </Link>
        )}
      </div>
      <p className="mt-1 text-[12px] text-muted">{ts("lp_portal.letters_subtitle")}</p>

      {newsletters.length === 0 && letters.length === 0 ? (
        <div className="mt-3 bg-white rounded-xl border border-line shadow-card p-6 text-center">
          <div className="h-10 w-10 rounded-full bg-paper2 flex items-center justify-center mx-auto">
            <FileText className="h-5 w-5 text-muted" />
          </div>
          <p className="mt-2 text-[12px] text-muted">{ts("lp_portal.letters_empty_body")}</p>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          {newsletters.slice(0, 4).map((n) => (
            <Link key={n.id} href={`/lp/newsletters/${n.id}`} className="group">
              <div className="bg-white rounded-2xl border border-line shadow-card hover:shadow-cardHover transition-shadow p-6 h-full flex flex-col">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] tracking-[0.16em] uppercase font-semibold text-gold-600">
                    {n.periodLabel}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3 className="mt-3 text-lg font-serif font-bold text-ink truncate">{n.coverTitle}</h3>
                {n.coverSubtitle && (
                  <p className="text-[12px] text-muted mt-1 line-clamp-2">{n.coverSubtitle}</p>
                )}
                {n.publishedAt && (
                  <div className="mt-4 pt-4 border-t border-line text-[11px] text-muted inline-flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    {new Date(n.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                )}
              </div>
            </Link>
          ))}
          {letters.map((l) => (
            <Link key={l.token} href={`/share/${l.token}`} className="group">
              <div className="bg-white rounded-2xl border border-line shadow-card hover:shadow-cardHover transition-shadow p-6 h-full flex flex-col">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] tracking-[0.16em] uppercase font-semibold text-gold-600">
                    Shared letter
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3 className="mt-3 text-lg font-serif font-bold text-ink">{l.organizationName}</h3>
                <div className="mt-4 pt-4 border-t border-line flex items-center justify-between text-[11px] text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    {new Date(l.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Eye className="h-3 w-3" /> {l.viewCount} view{l.viewCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function KpiTile({
  label, value, delta, positive, negative, icon: Icon,
}: {
  label: string;
  value: string;
  delta?: string | null;
  positive?: boolean;
  negative?: boolean;
  icon?: any;
}) {
  return (
    <div className="bg-white rounded-xl border border-line shadow-card p-3.5">
      <div className="text-[10px] font-semibold text-muted tracking-[0.14em] uppercase flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3 text-muted" />}
        {label}
      </div>
      <div className={`mt-1 font-serif text-xl font-bold leading-none tabular-nums ${negative ? "text-coral" : "text-ink"}`}>
        {value}
      </div>
      {delta && (
        <div className={`mt-1.5 text-[11px] font-medium tabular-nums ${positive ? "text-teal-600" : "text-coral"}`}>
          {delta}
        </div>
      )}
    </div>
  );
}
