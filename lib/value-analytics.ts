// L.20 — Value analytics. logUsageEvent() emits events from anywhere in the
// app; getValueSummary() reads them back; HOURS_PER_EVENT translates counts
// into "hours saved" estimates for the dashboard widget.
//
// Hours-saved heuristics are the GP-facing "look how much time we saved"
// story. Calibrate by looking at what GPs actually do manually:
//   - Generating an LP report from raw data:    ~4 hours
//   - Catching a bad metric in a portfolio of N: ~30 min if you happen to look
//   - Sending a form to N founders + reminders:  ~5 min/founder
//   - Reading + filing a founder submission:     ~3 min
//   - Bulk importing N rows of historical data: ~1 min/row (manual)
//   - One chat query that surfaces the answer:   ~5 min of digging avoided
//   - Posting a team update note:                ~negligible (1 min)

import { createClient } from "@/lib/supabase/server";

export type UsageEventKind =
  | "report_generated"
  | "alert_created"
  | "form_sent"
  | "form_received"
  | "chat_query"
  | "metrics_imported"
  | "lp_letter_published"
  | "company_update_posted";

/** Hours of GP/analyst time saved per event of each kind. Conservative. */
export const HOURS_PER_EVENT: Record<UsageEventKind, number> = {
  report_generated:      4.0,
  alert_created:         0.5,
  form_sent:             0.08,   // ~5 min per recipient
  form_received:         0.05,   // ~3 min to file/review
  chat_query:            0.08,   // ~5 min of digging avoided
  metrics_imported:      0.02,   // per row
  lp_letter_published:   3.0,    // similar to report but more polish
  company_update_posted: 0.02,   // negligible per-note, included for completeness
};

/** Insert a usage_event. Failures never throw — value tracking should never
 *  break a user-facing action. */
export async function logUsageEvent(input: {
  organizationId: string;
  userId?: string | null;
  kind: UsageEventKind;
  metadata?: Record<string, unknown>;
  count?: number; // emit N rows in one go (for batch ops like bulk-import)
}): Promise<void> {
  if (!input.organizationId) return;
  const supabase = createClient();
  const n = Math.max(1, Math.min(input.count ?? 1, 1000));
  const rows = Array.from({ length: n }, () => ({
    organization_id: input.organizationId,
    user_id: input.userId ?? null,
    kind: input.kind,
    metadata: (input.metadata ?? null) as any,
  }));
  try {
    const { error } = await supabase.from("usage_events").insert(rows);
    if (error) console.error("[value-analytics] insert failed:", error.message);
  } catch (err) {
    console.error("[value-analytics] insert threw:", err);
  }
}

export interface ValueSummary {
  total_events: number;
  by_kind: Array<{ kind: UsageEventKind; count: number }>;
  by_day: Array<{ day: string; count: number }>;
}

export async function getValueSummary(days = 30): Promise<ValueSummary | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("value_summary", { p_days: days });
  if (error) {
    console.error("[value-analytics] summary RPC failed:", error.message);
    return null;
  }
  return (data as unknown as ValueSummary) ?? null;
}

/** Estimate total hours saved given a by_kind breakdown. */
export function estimateHoursSaved(byKind: Array<{ kind: UsageEventKind; count: number }>): number {
  let hours = 0;
  for (const row of byKind) {
    const perEvent = HOURS_PER_EVENT[row.kind] ?? 0;
    hours += perEvent * row.count;
  }
  return hours;
}

export const KIND_LABEL: Record<UsageEventKind, string> = {
  report_generated:      "Report generated",
  alert_created:         "AI alert surfaced",
  form_sent:             "Form sent to founder",
  form_received:         "Founder submission received",
  chat_query:            "Pulso AI query",
  metrics_imported:      "Metric row imported",
  lp_letter_published:   "LP letter published",
  company_update_posted: "Team update posted",
};
