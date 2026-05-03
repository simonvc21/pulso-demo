// Server-only helper to log AI calls into ai_usage_events. Centralized so
// that every entry point uses the same conventions and never silently fails.

import { createClient } from "@/lib/supabase/server";

export type AiFeature = "chat" | "form_helper" | "metric_alerts" | "lp_summary" | "auto_title";

export interface LogAiCallInput {
  organizationId: string;
  userId?: string | null;
  feature: AiFeature;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  conversationId?: string | null;
}

/** Insert a row in ai_usage_events. The DB trigger computes cost. Failures
 *  are logged but never thrown so call sites stay simple. */
export async function logAiCall(input: LogAiCallInput): Promise<void> {
  if (!input.organizationId || !input.modelId) return;
  const supabase = createClient();
  const { error } = await supabase.from("ai_usage_events").insert({
    organization_id: input.organizationId,
    user_id: input.userId ?? null,
    feature: input.feature,
    model: input.modelId,
    input_tokens: input.inputTokens,
    output_tokens: input.outputTokens,
    conversation_id: input.conversationId ?? null,
  } as any);
  if (error) {
    console.error("[ai-usage] insert failed:", error.message);
  }
}

export interface AiUsageSummary {
  total_cost_usd_micro: number;
  total_calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  by_day: Array<{ day: string; calls: number; cost_micro: number }>;
  by_feature: Array<{ feature: string; calls: number; cost_micro: number; input_tokens: number; output_tokens: number }>;
  by_user: Array<{ user_label: string; calls: number; cost_micro: number }>;
}

export async function getAiUsageSummary(days = 30): Promise<AiUsageSummary | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("ai_usage_summary", { p_days: days });
  if (error) {
    console.error("[ai-usage] summary RPC failed:", error.message);
    return null;
  }
  return (data as unknown as AiUsageSummary) ?? null;
}

export function formatMicroUsd(micro: number): string {
  const dollars = micro / 1_000_000;
  if (dollars < 0.01) return `<$0.01`;
  if (dollars < 1) return `$${dollars.toFixed(2)}`;
  if (dollars < 100) return `$${dollars.toFixed(2)}`;
  return `$${Math.round(dollars).toLocaleString("en-US")}`;
}
