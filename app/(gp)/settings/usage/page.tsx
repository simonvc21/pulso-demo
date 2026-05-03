import Link from "next/link";
import { ArrowLeft, Sparkles, MessageSquare, Bell, FileText, Zap, AlertTriangle } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { TopbarBell } from "@/components/topbar-bell";
import { Badge } from "@/components/ui/badge";
import { getAiUsageSummary, formatMicroUsd } from "@/lib/ai-usage";
import { unstable_noStore as noStore } from "next/cache";
import { UsageChart } from "./usage-chart";

export const dynamic = "force-dynamic";

const FEATURE_LABEL: Record<string, { label: string; icon: any }> = {
  chat:           { label: "Chat",            icon: MessageSquare },
  form_helper:    { label: "Form helper",     icon: FileText },
  metric_alerts:  { label: "Metric alerts",   icon: Bell },
  lp_summary:     { label: "LP summary",      icon: Sparkles },
  auto_title:     { label: "Chat auto-title", icon: Zap },
};

export default async function AiUsagePage() {
  noStore();
  const summary = await getAiUsageSummary(30);

  return (
    <>
      <Topbar
        bell={<TopbarBell />}
        title="AI usage & cost"
        breadcrumb={
          <Link href="/settings" className="inline-flex items-center gap-1 hover:text-ink">
            <ArrowLeft className="h-3 w-3" /> Settings
          </Link>
        }
      />

      <div className="px-8 py-6 max-w-5xl space-y-6 animate-fade-in">
        {/* Top-line totals */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat
            label="Last 30 days · Cost"
            value={formatMicroUsd(summary?.total_cost_usd_micro ?? 0)}
            hint="Estimated Gemini spend"
          />
          <Stat
            label="AI calls"
            value={(summary?.total_calls ?? 0).toLocaleString("en-US")}
            hint="Across all features"
          />
          <Stat
            label="Input tokens"
            value={formatTokens(summary?.total_input_tokens ?? 0)}
            hint="Sent to model"
          />
          <Stat
            label="Output tokens"
            value={formatTokens(summary?.total_output_tokens ?? 0)}
            hint="Received from model"
          />
        </div>

        {/* Daily series */}
        <div className="bg-white rounded-xl border border-line shadow-card overflow-hidden">
          <div className="px-5 pt-4 pb-2 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-ink">Cost by day</h3>
              <p className="text-[11px] text-muted mt-0.5">Last 30 days · USD</p>
            </div>
            <span className="text-[11px] text-muted">Updates after each AI call</span>
          </div>
          <div className="px-2 pb-2">
            <UsageChart data={summary?.by_day ?? []} />
          </div>
        </div>

        {/* By feature */}
        <div className="bg-white rounded-xl border border-line shadow-card overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-line">
            <h3 className="text-sm font-semibold text-ink">By feature</h3>
            <p className="text-[11px] text-muted mt-0.5">Where the spend goes</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-paper2 text-[10px] tracking-[0.14em] uppercase text-muted">
                <th className="text-left font-semibold px-5 py-2.5">Feature</th>
                <th className="text-right font-semibold px-3 py-2.5">Calls</th>
                <th className="text-right font-semibold px-3 py-2.5">Input tokens</th>
                <th className="text-right font-semibold px-3 py-2.5">Output tokens</th>
                <th className="text-right font-semibold px-5 py-2.5">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-sm">
              {(summary?.by_feature ?? []).map((row) => {
                const meta = FEATURE_LABEL[row.feature] ?? { label: row.feature, icon: Zap };
                const Icon = meta.icon;
                return (
                  <tr key={row.feature} className="hover:bg-paper">
                    <td className="px-5 py-2.5">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-7 w-7 rounded-lg bg-paper2 flex items-center justify-center">
                          <Icon className="h-3.5 w-3.5 text-muted" />
                        </span>
                        <span className="text-sm font-medium text-ink">{meta.label}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink">{row.calls.toLocaleString("en-US")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted">{formatTokens(row.input_tokens)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted">{formatTokens(row.output_tokens)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums font-semibold text-ink">{formatMicroUsd(row.cost_micro)}</td>
                  </tr>
                );
              })}
              {(summary?.by_feature ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-[12px] text-muted">
                    No AI calls in the last 30 days yet. Open the chat dock or trigger an alert to start tracking.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* By user */}
        <div className="bg-white rounded-xl border border-line shadow-card overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-line">
            <h3 className="text-sm font-semibold text-ink">By user</h3>
            <p className="text-[11px] text-muted mt-0.5">Who's using Pulso AI most</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-paper2 text-[10px] tracking-[0.14em] uppercase text-muted">
                <th className="text-left font-semibold px-5 py-2.5">User</th>
                <th className="text-right font-semibold px-3 py-2.5">Calls</th>
                <th className="text-right font-semibold px-5 py-2.5">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-sm">
              {(summary?.by_user ?? []).map((row) => (
                <tr key={row.user_label} className="hover:bg-paper">
                  <td className="px-5 py-2.5 text-ink">{row.user_label}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">{row.calls.toLocaleString("en-US")}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums font-semibold text-ink">{formatMicroUsd(row.cost_micro)}</td>
                </tr>
              ))}
              {(summary?.by_user ?? []).length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-12 text-center text-[12px] text-muted">
                    No usage yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="text-[11px] text-muted">
          <strong className="text-ink">Note:</strong> Cost is estimated from Gemini's published rates (Flash: $0.075 / M input + $0.30 / M output; Pro: $1.25 / M input + $5 / M output). Actual billing comes from Google Cloud.
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white rounded-xl border border-line p-4 shadow-card">
      <div className="text-[10px] font-semibold text-muted tracking-[0.14em] uppercase">{label}</div>
      <div className="mt-1 font-serif text-2xl font-bold text-ink leading-none tabular-nums">{value}</div>
      {hint && <div className="mt-1.5 text-[11px] text-muted">{hint}</div>}
    </div>
  );
}

function formatTokens(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}
