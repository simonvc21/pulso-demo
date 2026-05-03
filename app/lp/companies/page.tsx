import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { getCompanyList, getFund } from "@/lib/dashboard-data";
import { fmtUSD, fmtPct } from "@/lib/utils";

export const dynamic = "force-dynamic";

const countryFlag: Record<string, string> = {
  MX: "🇲🇽", BR: "🇧🇷", CO: "🇨🇴", CL: "🇨🇱", AR: "🇦🇷", PE: "🇵🇪",
};

export default async function LpCompaniesListPage() {
  const [companies, fund] = await Promise.all([getCompanyList(), getFund()]);
  const fundName = fund?.name ?? "Your fund";

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <Link href="/lp" className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-ink">
        <ArrowLeft className="h-3 w-3" /> Back to letters
      </Link>
      <div className="mt-3 text-[11px] font-semibold text-gold-600 tracking-[0.18em] uppercase">{fundName} · Portfolio</div>
      <h1 className="mt-2 text-3xl font-serif font-bold text-ink leading-tight">
        Companies in this fund
      </h1>
      <p className="mt-2 text-sm text-muted">
        {companies.length} active companies. Tap any name for live KPIs and quarterly history.
      </p>

      <div className="mt-8 bg-white rounded-xl border border-line shadow-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-paper2 text-[10px] tracking-[0.14em] text-muted uppercase">
              <th className="text-left font-semibold px-5 py-3">Company</th>
              <th className="text-left font-semibold px-3 py-3 hidden md:table-cell">Sector</th>
              <th className="text-left font-semibold px-3 py-3 hidden md:table-cell">Stage</th>
              <th className="text-right font-semibold px-3 py-3 hidden sm:table-cell">ARR</th>
              <th className="text-right font-semibold px-3 py-3 hidden sm:table-cell">QoQ</th>
              <th className="text-left font-semibold px-3 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {companies.map((c) => {
              const last = c.metrics[c.metrics.length - 1];
              const prev = c.metrics[c.metrics.length - 2];
              const lastArr = last?.arr ?? 0;
              const prevArr = prev?.arr ?? 0;
              const qoq = prevArr > 0 ? ((lastArr - prevArr) / prevArr) * 100 : 0;
              return (
                <tr key={c.slug} className="hover:bg-paper transition-colors group">
                  <td className="px-5 py-3">
                    <Link href={`/lp/companies/${c.slug}`} className="flex items-center gap-3">
                      {c.logoUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={c.logoUrl}
                          alt={c.name}
                          className="h-9 w-9 rounded-lg object-contain bg-white border border-line shrink-0"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded-lg bg-navy flex items-center justify-center text-gold font-serif font-bold text-sm shrink-0">
                          {c.name[0]}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-ink">{c.name}</span>
                          {c.country && <span className="text-xs">{countryFlag[c.country] ?? ""}</span>}
                          <ArrowUpRight className="h-3.5 w-3.5 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        {c.description && (
                          <div className="text-[11px] text-muted truncate max-w-[280px]">{c.description}</div>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-xs text-ink hidden md:table-cell">{c.sector ? <Badge>{c.sector}</Badge> : null}</td>
                  <td className="px-3 py-3 text-xs text-ink hidden md:table-cell">{c.stage}</td>
                  <td className="px-3 py-3 text-sm font-semibold text-ink text-right tabular-nums hidden sm:table-cell">{fmtUSD(lastArr, { compact: true })}</td>
                  <td className={`px-3 py-3 text-xs font-medium text-right tabular-nums hidden sm:table-cell ${qoq >= 0 ? "text-teal-600" : "text-coral"}`}>{prevArr > 0 ? fmtPct(qoq, 1) : "—"}</td>
                  <td className="px-3 py-3"><StatusBadge status={c.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
