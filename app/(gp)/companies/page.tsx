import Link from "next/link";
import { Topbar } from "@/components/topbar";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { companies } from "@/lib/mock-data";
import { fmtUSD, fmtPct } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";

const countryFlag: Record<string, string> = {
  MX: "🇲🇽", BR: "🇧🇷", CO: "🇨🇴", CL: "🇨🇱", AR: "🇦🇷", PE: "🇵🇪",
};

export default function CompaniesPage() {
  return (
    <>
      <Topbar title="Companies" breadcrumb="Patagonia Fund I · 8 active" />
      <div className="px-8 py-6 animate-fade-in">
        <div className="bg-white rounded-xl border border-line shadow-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-paper2 text-[10px] tracking-[0.14em] text-muted uppercase">
                <th className="text-left font-semibold px-5 py-3">Company</th>
                <th className="text-left font-semibold px-3 py-3">Sector</th>
                <th className="text-left font-semibold px-3 py-3">Stage</th>
                <th className="text-right font-semibold px-3 py-3">Invested</th>
                <th className="text-right font-semibold px-3 py-3">ARR (Q1 26)</th>
                <th className="text-right font-semibold px-3 py-3">QoQ</th>
                <th className="text-left font-semibold px-3 py-3">Status</th>
                <th className="text-right font-semibold px-5 py-3">Last update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {companies.map((c) => {
                const last = c.metrics[c.metrics.length - 1];
                const prev = c.metrics[c.metrics.length - 2];
                const qoq = ((last.arr - prev.arr) / prev.arr) * 100;
                return (
                  <tr key={c.slug} className="hover:bg-paper transition-colors group">
                    <td className="px-5 py-3">
                      <Link href={`/companies/${c.slug}`} className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-navy flex items-center justify-center text-gold font-serif font-bold text-sm shrink-0">
                          {c.name[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-ink">{c.name}</span>
                            <span className="text-xs">{countryFlag[c.country]}</span>
                            <ArrowUpRight className="h-3.5 w-3.5 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="text-[11px] text-muted truncate max-w-[280px]">{c.description}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-xs text-ink"><Badge>{c.sector}</Badge></td>
                    <td className="px-3 py-3 text-xs text-ink">{c.stage}</td>
                    <td className="px-3 py-3 text-xs text-ink text-right tabular-nums">{fmtUSD(c.invested, { compact: true })}</td>
                    <td className="px-3 py-3 text-sm font-semibold text-ink text-right tabular-nums">{fmtUSD(last.arr, { compact: true })}</td>
                    <td className={`px-3 py-3 text-xs font-medium text-right tabular-nums ${qoq >= 0 ? "text-teal-600" : "text-coral"}`}>{fmtPct(qoq, 1)}</td>
                    <td className="px-3 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-5 py-3 text-[11px] text-muted text-right">{c.lastUpdate}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
