// L.6 — LP-side list of published newsletters.

import Link from "next/link";
import { ArrowLeft, ChevronRight, FileText, Calendar } from "lucide-react";
import { listNewsletters } from "@/lib/newsletter";

export const dynamic = "force-dynamic";

export default async function LpNewslettersPage() {
  const newsletters = await listNewsletters({ publishedOnly: true });

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <Link href="/lp" className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-ink">
        <ArrowLeft className="h-3 w-3" /> Back to portal
      </Link>
      <div className="mt-3 text-[11px] font-semibold text-gold-600 tracking-[0.18em] uppercase">Fund letters</div>
      <h1 className="mt-2 text-3xl font-serif font-bold text-ink leading-tight">Quarterly updates</h1>
      <p className="mt-2 text-sm text-muted">
        Every newsletter your GP has published, newest first.
      </p>

      {newsletters.length === 0 ? (
        <div className="mt-8 bg-white rounded-2xl border border-line shadow-card p-10 text-center">
          <div className="h-12 w-12 rounded-full bg-paper2 flex items-center justify-center mx-auto">
            <FileText className="h-6 w-6 text-muted" />
          </div>
          <p className="mt-4 text-[13px] text-muted">No newsletters published yet.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {newsletters.map((n) => (
            <li key={n.id}>
              <Link href={`/lp/newsletters/${n.id}`} className="block group">
                <div className="bg-white rounded-xl border border-line shadow-card p-5 flex items-start gap-4 hover:shadow-cardHover transition-shadow">
                  <div className="h-10 w-10 rounded-lg bg-gold/15 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-gold-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-semibold tracking-[0.16em] uppercase text-gold-600">
                      {n.periodLabel} · {n.cadence === "ad_hoc" ? "Special update" : `${n.cadence} update`}
                    </div>
                    <h3 className="mt-1 text-lg font-serif font-bold text-ink group-hover:underline underline-offset-2">
                      {n.coverTitle}
                    </h3>
                    {n.coverSubtitle && (
                      <p className="mt-1 text-[13px] text-muted">{n.coverSubtitle}</p>
                    )}
                    {n.heroMetricSummary && (
                      <p className="mt-2 text-[11px] text-muted">{n.heroMetricSummary}</p>
                    )}
                    {n.publishedAt && (
                      <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted">
                        <Calendar className="h-3 w-3" />
                        Published {new Date(n.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted group-hover:text-teal-600 shrink-0" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
