"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isCurrentUserAdmin, type FeatureFlagName, FEATURE_DEFAULTS } from "@/lib/feature-flags";

export type AdminResult = { ok: true; message?: string } | { ok: false; error: string };

async function requireAdmin(): Promise<{ ok: true; supabase: ReturnType<typeof createClient> } | { ok: false; error: string }> {
  const admin = await isCurrentUserAdmin();
  if (!admin) return { ok: false, error: "Admin access required" };
  return { ok: true, supabase: createClient() };
}

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------

export async function setFeatureFlag(input: {
  organizationId: string;
  flagName: string;
  enabled: boolean;
  notes?: string | null;
}): Promise<AdminResult> {
  if (!input.organizationId) return { ok: false, error: "organization_id required" };
  if (!(input.flagName in FEATURE_DEFAULTS)) return { ok: false, error: "Unknown flag" };

  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx;

  // Find the public.users.id for `updated_by_user_id`.
  const { data: { user } } = await ctx.supabase.auth.getUser();
  let updaterId: string | null = null;
  if (user) {
    const { data: u } = await ctx.supabase
      .from("users")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    updaterId = u?.id ?? null;
  }

  const { error } = await ctx.supabase
    .from("feature_flags")
    .upsert(
      {
        organization_id: input.organizationId,
        flag_name: input.flagName as FeatureFlagName,
        enabled: input.enabled,
        notes: input.notes ?? null,
        updated_by_user_id: updaterId,
      } as any,
      { onConflict: "organization_id,flag_name" },
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/feature-flags");
  return { ok: true };
}

export async function clearFeatureFlag(input: { organizationId: string; flagName: string }): Promise<AdminResult> {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx;

  const { error } = await ctx.supabase
    .from("feature_flags")
    .delete()
    .eq("organization_id", input.organizationId)
    .eq("flag_name", input.flagName);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/feature-flags");
  return { ok: true, message: "Reset to default" };
}

// ---------------------------------------------------------------------------
// System tools
// ---------------------------------------------------------------------------

export async function resetOrgAiUsage(input: { organizationId: string }): Promise<AdminResult> {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx;

  // Wipe both the daily-quota table and the granular event log so the org
  // gets a fresh budget. Keep the foreign keys clean. ai_usage isn't in
  // database.types yet (legacy table) — cast through any.
  const { error: e1 } = await (ctx.supabase as any)
    .from("ai_usage")
    .delete()
    .eq("organization_id", input.organizationId);
  if (e1) return { ok: false, error: e1.message };

  const { error: e2 } = await ctx.supabase
    .from("ai_usage_events")
    .delete()
    .eq("organization_id", input.organizationId);
  if (e2) return { ok: false, error: e2.message };

  revalidatePath("/admin/system-tools");
  revalidatePath("/settings/usage");
  return { ok: true, message: "AI usage reset" };
}

export async function forceUserOnboarding(input: { userEmail: string }): Promise<AdminResult> {
  const email = input.userEmail.trim().toLowerCase();
  if (!email) return { ok: false, error: "Email required" };

  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx;

  // Detach the user from their org so /auth/post-login routes them to /onboarding.
  const { data, error } = await ctx.supabase
    .from("users")
    .update({ organization_id: null })
    .ilike("email", email)
    .select("id, email");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: `No user with email "${email}"` };

  revalidatePath("/admin/system-tools");
  return { ok: true, message: `Detached ${data[0].email} — they'll see /onboarding next sign-in` };
}

export async function rerunMetricAlerts(input: { organizationId: string }): Promise<AdminResult> {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx;

  // The existing run_metric_alerts() RPC is per-caller (uses auth.uid →
  // organization). For admin re-run on an arbitrary org, we'd need a
  // SECURITY DEFINER variant that takes p_org. For now, document the
  // limitation and trigger the standard endpoint.
  const { error } = await ctx.supabase.rpc("run_metric_alerts");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/system-tools");
  return { ok: true, message: "Metric alerts re-run for your org" };
}
