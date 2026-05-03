// L.23 — Feature flags. Single source of truth for which features are
// gated and what their defaults are.
//
// Usage:
//   import { isFeatureEnabled } from "@/lib/feature-flags";
//   if (await isFeatureEnabled("workflows_v2")) { ... }
//
// On the server only — RLS lets org members read their own flags.

import { createClient } from "@/lib/supabase/server";

/** Every flag must be declared here with a label, description, and default
 *  state. New code that wants to be guarded behind a flag should add to
 *  this list — keeps everything reviewable in one place. */
export const FEATURE_DEFAULTS = {
  workflows_v2:           { default: false, label: "Workflows engine (L.17)",       description: "New trigger → action automation system." },
  monthly_metrics:        { default: false, label: "Monthly metrics (L.12)",        description: "Per-company tracking_cadence enum + month-level data." },
  multi_fund:             { default: false, label: "Multi-fund (L.18)",             description: "1 organization → N funds with consolidated views." },
  lp_engagement:          { default: false, label: "LP engagement (L.22)",          description: "Comments + reactions on company pages." },
  one_active_form:        { default: false, label: "One active form per startup (L.11)", description: "Founders see THE current form, not the template list." },
  email_automation:       { default: false, label: "Email automation (L.19)",       description: "Real Resend sending of LP updates + reminders." },
  billing_engine:         { default: false, label: "Billing engine (L.14)",         description: "Stripe-powered plans + usage-based gates." },
  ai_chat_history:        { default: true,  label: "AI chat history (L.13)",        description: "Persistent conversation log in the dock." },
  ai_usage_dashboard:     { default: true,  label: "AI usage dashboard (L.15)",     description: "/settings/usage cost + token analytics." },
  custom_metrics:         { default: true,  label: "Custom metrics (L.4)",          description: "Per-company metrics on top of the universal 5." },
  csv_import:             { default: true,  label: "CSV/Excel metrics import (B.4)", description: "/data + onboarding bulk metrics import." },
  form_calendar:          { default: true,  label: "Form schedule + calendar (L.10)", description: "GP-controlled cadence + calendar view." },
} as const satisfies Record<string, { default: boolean; label: string; description: string }>;

export type FeatureFlagName = keyof typeof FEATURE_DEFAULTS;

export function listAllFlags(): { name: FeatureFlagName; default: boolean; label: string; description: string }[] {
  return (Object.keys(FEATURE_DEFAULTS) as FeatureFlagName[]).map((name) => ({
    name,
    default: FEATURE_DEFAULTS[name].default,
    label: FEATURE_DEFAULTS[name].label,
    description: FEATURE_DEFAULTS[name].description,
  }));
}

/** Resolve whether a feature is enabled for the caller's org. Falls back to
 *  the in-code default if no row exists. */
export async function isFeatureEnabled(name: FeatureFlagName, orgId?: string): Promise<boolean> {
  const supabase = createClient();
  let q = supabase.from("feature_flags").select("enabled").eq("flag_name", name).limit(1);
  if (orgId) q = q.eq("organization_id", orgId);
  const { data } = await q.maybeSingle();
  if (data) return data.enabled;
  return FEATURE_DEFAULTS[name].default;
}

/** Bulk-load flags for all known names so a page can render conditional UI
 *  without N round-trips. Falls back to defaults for missing rows. */
export async function getOrgFlags(orgId: string): Promise<Record<FeatureFlagName, boolean>> {
  const supabase = createClient();
  const { data } = await supabase
    .from("feature_flags")
    .select("flag_name, enabled")
    .eq("organization_id", orgId);
  const out = {} as Record<FeatureFlagName, boolean>;
  for (const name of Object.keys(FEATURE_DEFAULTS) as FeatureFlagName[]) {
    out[name] = FEATURE_DEFAULTS[name].default;
  }
  for (const r of data ?? []) {
    if ((r.flag_name as FeatureFlagName) in FEATURE_DEFAULTS) {
      out[r.flag_name as FeatureFlagName] = r.enabled;
    }
  }
  return out;
}

/** Server-side admin check via the SECURITY DEFINER public.is_admin() RPC.
 *  Works regardless of which org the user is in. */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase.rpc("is_admin");
  return Boolean(data);
}
