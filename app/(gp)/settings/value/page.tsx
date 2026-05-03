import Link from "next/link";
import { ArrowLeft, Sparkles, Clock } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { TopbarBell } from "@/components/topbar-bell";
import {
  getValueSummary,
  estimateHoursSaved,
  HOURS_PER_EVENT,
  KIND_LABEL,
  type UsageEventKind,
} from "@/lib/value-analytics";
import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";

export default async function ValueAnalyticsPage() {
  noStore();
  const summary = await getValueSummary(30);
  const hours = summary ? estimateHoursSaved(summary.by_kind) : 0;

  return (
    <>
      <Topbar
        bell={<TopbarBell />}
        title="Value delivered"
        breadcrumb={
          <Link href="/settings" className="inline-flex items-center gap-1 hover:text-ink">
            <ArrowLeft className="h-3 w-3" /> Settings
          </Link>
        }
      />

      <div className="px-8 py-6 max-w-5xl space-y-6 animate-fade-in">
        {/* Hero stat */}
        <div className="bg-gradient-to-br from-navy to-navy-700 text-white rounded-2xl p-8 shadow-card">
          <div className="flex items-start gap-5">
            <div className="h-14 w-14 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
              <Sparkles className="h-6 w-6 text-gold" fill="currentColor" />
            </div>
            <div className="flex-1">
              <div className="text-[10px] tracking-[0.18em] uppercase text-gold font-semibold">
                Last 30 days
              </div>
              <div className="mt-1 font-serif text-4xl font-bold leading-none">
                ~{hours.toFixed(0)} hours saved
              </div>
              <p className="text-[13px] text-white/70 mt-2 max-w-xl">
                Conservative estimate based on real activity in your fund. Each event uses a hours-per-event heuristic — you'd otherwise spend this time pulling spreadsheets, drafting summaries, or chasing founders.
              </p>
            </div>
          </div>
        </div>

        {/* Breakdown */}
        <div className="bg-white rounded-xl border border-line shadow-card overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-line">
            <h3 className="text-sm font-semibold text-ink">Breakdown</h3>
            <p className="text-[11px] text-muted mt-0.5">Where the time savings come from</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-paper2 text-[10px] tracking-[0.14em] uppercase text-muted">
                <th className="text-left font-semibold px-5 py-2.5">Action</th>
                <th className="text-right font-semibold px-3 py-2.5">Count</th>
                <th className="text-right font-semibold px-3 py-2.5">Per event</th>
                <th className="text-right font-semibold px-5 py-2.5">Hours saved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-sm">
              {(summary?.by_kind ?? []).map((row) => {
                const perEvent = HOURS_PER_EVENT[row.kind as UsageEventKind] ?? 0;
                const total = perEvent * row.count;
                return (
                  <tr key={row.kind} className="hover:bg-paper">
                    <td className="px-5 py-2.5 text-ink">{KIND_LABEL[row.kind as UsageEventKind] ?? row.kind}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink">{row.count.toLocaleString("en-US")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted">
                      {perEvent < 1 ? `${Math.round(perEvent * 60)} min` : `${perEvent.toFixed(1)} h`}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums font-semibold text-ink">
                      {total.toFixed(1)} h
                    </td>
                  </tr>
                );
              })}
              {(!summary || summary.by_kind.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-[12px] text-muted">
                    No tracked activity yet in the last 30 days. Open the chat dock, send a form, or import metrics to start the counter.
                  </td>
                </tr>
              )}
              {summary && summary.by_kind.length > 0 && (
                <tr className="bg-paper2 font-semibold">
                  <td className="px-5 py-2.5 text-ink inline-flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Total
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                    {summary.total_events.toLocaleString("en-US")}
                  </td>
                  <td className="px-3 py-2.5"></td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-ink">{hours.toFixed(1)} h</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="text-[11px] text-muted">
          <strong className="text-ink">Methodology:</strong> Each tracked action gets a baseline manual cost (e.g. 5 min per form sent, 3 min per founder submission to file, 4 hours per LP report drafted from raw data). Heuristics live in <code className="bg-paper2 px-1 rounded">lib/value-analytics.ts</code> and are conservative on purpose — real time saved is usually higher.
        </div>
      </div>
    </>
  );
}
