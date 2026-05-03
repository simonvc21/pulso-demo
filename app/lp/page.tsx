import Link from "next/link";
import { ChevronRight, FileText, Calendar, Eye, Briefcase } from "lucide-react";
import { getLpLetters, getCompanyList } from "@/lib/dashboard-data";
import { ts } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function LpHomePage() {
  const [letters, companies] = await Promise.all([getLpLetters(), getCompanyList()]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="text-[11px] font-semibold text-gold-600 tracking-[0.18em] uppercase">{ts("lp_portal.header")}</div>
      <h1 className="mt-2 text-3xl font-serif font-bold text-ink leading-tight">
        {ts("lp_portal.letters_title")}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {ts("lp_portal.letters_subtitle")}
      </p>

      {companies.length > 0 && (
        <Link href="/lp/companies" className="block group mt-8">
          <div className="bg-gradient-to-r from-navy to-navy-700 text-white rounded-2xl p-6 flex items-center gap-5 hover:shadow-cardHover transition-shadow">
            <div className="h-12 w-12 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
              <Briefcase className="h-5 w-5 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] tracking-[0.18em] uppercase text-gold font-semibold">{ts("lp_portal.portfolio_callout_label")}</div>
              <h2 className="mt-1 text-lg font-serif font-bold">{ts("lp_portal.portfolio_callout_title", { n: companies.length })}</h2>
              <p className="text-[12px] text-white/70 mt-1">{ts("lp_portal.portfolio_callout_body")}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-white/60 group-hover:text-gold transition-colors shrink-0" />
          </div>
        </Link>
      )}

      {letters.length === 0 ? (
        <div className="mt-10 bg-white rounded-2xl border border-line shadow-card p-10 text-center">
          <div className="h-12 w-12 rounded-full bg-paper2 flex items-center justify-center mx-auto">
            <FileText className="h-6 w-6 text-muted" />
          </div>
          <h2 className="mt-4 text-base font-serif font-semibold text-ink">{ts("lp_portal.letters_empty_title")}</h2>
          <p className="mt-2 text-[13px] text-muted max-w-md mx-auto">
            {ts("lp_portal.letters_empty_body")}
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {letters.map((l) => (
            <Link key={l.token} href={`/share/${l.token}`} className="group">
              <div className="bg-white rounded-2xl border border-line shadow-card hover:shadow-cardHover transition-shadow p-6 h-full flex flex-col">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] tracking-[0.16em] uppercase font-semibold text-gold-600">
                    Quarterly letter
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
