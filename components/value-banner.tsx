import Link from "next/link";
import { Sparkles, ChevronRight } from "lucide-react";
import { getValueSummary, estimateHoursSaved } from "@/lib/value-analytics";

/** L.20 — "This month with Pulso" banner for the GP dashboard. Quiet when
 *  there's no activity yet. */
export async function ValueBanner() {
  const summary = await getValueSummary(30);
  if (!summary || summary.total_events === 0) return null;

  const hours = estimateHoursSaved(summary.by_kind);
  const reportsRow = summary.by_kind.find((r) => r.kind === "report_generated");
  const alertsRow = summary.by_kind.find((r) => r.kind === "alert_created");
  const formsRow = summary.by_kind.find((r) => r.kind === "form_received");

  return (
    <Link href="/settings/value" className="block group">
      <div className="bg-gradient-to-r from-navy to-navy-700 rounded-xl border border-navy/20 shadow-card p-5 text-white flex items-center gap-5 hover:shadow-cardHover transition-shadow">
        <div className="h-11 w-11 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
          <Sparkles className="h-5 w-5 text-gold" fill="currentColor" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] tracking-[0.18em] uppercase text-gold font-semibold">
            This month with Pulso
          </div>
          <div className="mt-1 text-base sm:text-lg font-serif font-bold leading-tight">
            ~{hours.toFixed(0)} hour{hours.toFixed(0) === "1" ? "" : "s"} saved
            <span className="text-white/60 font-normal text-sm ml-2">
              {reportsRow ? `· ${reportsRow.count} report${reportsRow.count === 1 ? "" : "s"}` : ""}
              {alertsRow ? ` · ${alertsRow.count} alert${alertsRow.count === 1 ? "" : "s"}` : ""}
              {formsRow ? ` · ${formsRow.count} submission${formsRow.count === 1 ? "" : "s"}` : ""}
            </span>
          </div>
          <div className="text-[11px] text-white/70 mt-0.5">
            Estimated from activity in the last 30 days. Click for the full breakdown.
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-white/60 group-hover:text-gold transition-colors shrink-0" />
      </div>
    </Link>
  );
}
