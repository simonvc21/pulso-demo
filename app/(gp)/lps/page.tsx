import Link from "next/link";
import { Topbar } from "@/components/topbar";
import { TopbarBell } from "@/components/topbar-bell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getLpRoster, getFund } from "@/lib/dashboard-data";
import { fmtUSD } from "@/lib/utils";
import { Share2, Mail, MessageSquare } from "lucide-react";
import { listLpThreads } from "@/lib/lp-chat";
import { AddLpButton } from "./add-lp-button";
import { DeleteLpButton } from "./delete-lp-button";
import { LpsCsvImport } from "@/components/lps-csv-import";

export const dynamic = "force-dynamic";

const countryFlag: Record<string, string> = {
  MX: "🇲🇽", BR: "🇧🇷", CO: "🇨🇴", CL: "🇨🇱", AR: "🇦🇷", PE: "🇵🇪",
};

export default async function LpsPage() {
  const [lps, fund, threads] = await Promise.all([getLpRoster(), getFund(), listLpThreads()]);
  const threadByLpId = new Map(threads.map((t) => [t.lpId, t]));
  const totalCommit = lps.reduce((a, l) => a + l.commitment, 0);
  const fundSize = Number(fund?.size_usd ?? 0);

  return (
    <>
      <Topbar
        bell={<TopbarBell />}
        title="LPs"
        breadcrumb={`${lps.length} limited partners · ${fmtUSD(totalCommit, { compact: true })} committed`}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/share/q1-2026-lp-letter?preview=1" target="_blank"><Button variant="outline" size="sm" className="gap-1.5"><Share2 className="h-3.5 w-3.5" /> Preview LP letter</Button></Link>
            <LpsCsvImport />
            <AddLpButton />
          </div>
        }
      />
      <div className="px-8 py-6 animate-fade-in">
        <div className="bg-white rounded-xl border border-line shadow-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-paper2 text-[10px] tracking-[0.14em] text-muted uppercase">
                <th className="text-left font-semibold px-5 py-3">LP</th>
                <th className="text-left font-semibold px-3 py-3">Type</th>
                <th className="text-right font-semibold px-3 py-3">Commitment</th>
                <th className="text-right font-semibold px-3 py-3">% of fund</th>
                <th className="text-left font-semibold px-3 py-3">Last access</th>
                <th className="text-right font-semibold px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {lps.map((l) => (
                <tr key={l.id} className="hover:bg-paper transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-paper2 flex items-center justify-center text-navy font-serif font-bold text-sm shrink-0">
                        {l.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-ink">
                          {l.name}{" "}
                          {l.country && <span className="text-xs">{countryFlag[l.country] ?? ""}</span>}
                        </div>
                        {l.email && <div className="text-[11px] text-muted">{l.email}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3"><Badge>{l.type}</Badge></td>
                  <td className="px-3 py-3 text-sm font-semibold text-ink text-right tabular-nums">{fmtUSD(l.commitment, { compact: true })}</td>
                  <td className="px-3 py-3 text-xs text-muted text-right tabular-nums">{fundSize > 0 ? `${((l.commitment / fundSize) * 100).toFixed(1)}%` : "—"}</td>
                  <td className="px-3 py-3 text-[11px] text-muted">{l.lastAccess}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Link
                        href={`/lps/${l.id}/chat`}
                        className="relative text-muted hover:text-ink p-1.5 inline-flex"
                        title="Open chat thread"
                      >
                        <MessageSquare className="h-4 w-4" />
                        {(threadByLpId.get(l.id)?.unreadFromLp ?? 0) > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 bg-coral text-white text-[9px] font-bold rounded-full px-1 min-w-[14px] h-[14px] flex items-center justify-center">
                            {threadByLpId.get(l.id)!.unreadFromLp}
                          </span>
                        )}
                      </Link>
                      {l.email ? (
                        <a href={`mailto:${l.email}`} className="text-muted hover:text-ink p-1.5 inline-flex" title="Email"><Mail className="h-4 w-4" /></a>
                      ) : (
                        <button className="text-muted hover:text-ink p-1.5" title="No email on file"><Mail className="h-4 w-4" /></button>
                      )}
                      <DeleteLpButton lpId={l.id} name={l.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
