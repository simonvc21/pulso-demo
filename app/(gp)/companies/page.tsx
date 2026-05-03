import Link from "next/link";
import { Topbar } from "@/components/topbar";
import { TopbarBell } from "@/components/topbar-bell";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { getCompanyList, getFund, getArchivedCompanyCount } from "@/lib/dashboard-data";
import { fmtUSD, fmtPct } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";
import { ts } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

const countryFlag: Record<string, string> = {
  MX: "🇲🇽", BR: "🇧🇷", CO: "🇨🇴", CL: "🇨🇱", AR: "🇦🇷", PE: "🇵🇪",
};

const instrumentLabel: Record<string, string> = {
  safe: "SAFE",
  convertible_note: "Conv. Note",
  equity: "Equity",
  saft: "SAFT",
  warrant: "Warrant",
  loan: "Loan",
  other: "Other",
};

export default async function CompaniesPage({ searchParams }: { searchParams: { archived?: string } }) {
  const showArchived = searchParams?.archived === "1";
  const [companies, fund, archivedCount] = await Promise.all([
    getCompanyList({ archived: showArchived }),
    getFund(),
    getArchivedCompanyCount(),
  ]);
  const fundName = fund?.name ?? "Your fund";

  return (
    <>
      <Topbar
        title={ts("companies.title")}
        breadcrumb={`${fundName} · ${companies.length} ${showArchived ? "archived" : ts("companies.breadcrumb_active")}`}
        bell={<TopbarBell />}
      />
      <div className="px-8 py-6 animate-fade-in space-y-3">
        <div className="flex items-center gap-2">
          <Link
            href="/companies"
            className={`text-[12px] px-2.5 h-7 inline-flex items-center rounded-md border ${!showArchived ? "bg-navy text-white border-navy" : "bg-white text-muted border-line hover:text-ink"}`}
          >
            Active
          </Link>
          <Link
            href="/companies?archived=1"
            className={`text-[12px] px-2.5 h-7 inline-flex items-center gap-1.5 rounded-md border ${showArchived ? "bg-navy text-white border-navy" : "bg-white text-muted border-line hover:text-ink"}`}
          >
            Archived
            {archivedCount > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums ${showArchived ? "bg-white/20 text-white" : "bg-paper2 text-muted"}`}>
                {archivedCount}
              </span>
            )}
          </Link>
        </div>
        <div className="bg-white rounded-xl border border-line shadow-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-paper2 text-[10px] tracking-[0.14em] text-muted uppercase">
                <th className="text-left font-semibold px-5 py-3">{ts("companies.col_company")}</th>
                <th className="text-left font-semibold px-3 py-3">{ts("companies.col_sector")}</th>
                <th className="text-left font-semibold px-3 py-3">{ts("companies.col_stage")}</th>
                <th className="text-left font-semibold px-3 py-3">{ts("companies.col_instrument")}</th>
                <th className="text-right font-semibold px-3 py-3">{ts("companies.col_invested")}</th>
                <th className="text-right font-semibold px-3 py-3">{ts("companies.col_arr")}</th>
                <th className="text-right font-semibold px-3 py-3">{ts("companies.col_qoq")}</th>
                <th className="text-left font-semibold px-3 py-3">{ts("companies.col_status")}</th>
                <th className="text-right font-semibold px-5 py-3">{ts("companies.col_last_update")}</th>
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
                      <Link href={`/companies/${c.slug}`} className="flex items-center gap-3">
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
                    <td className="px-3 py-3 text-xs text-ink">{c.sector ? <Badge>{c.sector}</Badge> : null}</td>
                    <td className="px-3 py-3 text-xs text-ink">{c.stage}</td>
                    <td className="px-3 py-3 text-xs">
                      {c.investmentInstrument ? (
                        <Badge tone="gold">{instrumentLabel[c.investmentInstrument] ?? c.investmentInstrument}</Badge>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-ink text-right tabular-nums">{fmtUSD(c.invested, { compact: true })}</td>
                    <td className="px-3 py-3 text-sm font-semibold text-ink text-right tabular-nums">{fmtUSD(lastArr, { compact: true })}</td>
                    <td className={`px-3 py-3 text-xs font-medium text-right tabular-nums ${qoq >= 0 ? "text-teal-600" : "text-coral"}`}>{prevArr > 0 ? fmtPct(qoq, 1) : "—"}</td>
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
