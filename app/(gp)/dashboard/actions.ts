"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  parseDashboardConfig,
  type DashboardConfig,
} from "@/lib/dashboard-config";

export type SaveDashboardConfigResult = { ok: true } | { ok: false; error: string };

async function requireOrg() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };
  const { data: row } = await supabase
    .from("users")
    .select("organization_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!row?.organization_id) return { ok: false as const, error: "No fund assigned" };
  return { ok: true as const, supabase, organizationId: row.organization_id };
}

export async function saveDashboardConfig(input: DashboardConfig): Promise<SaveDashboardConfigResult> {
  const ctx = await requireOrg();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  // Re-parse server-side to enforce shape + drop unknown fields.
  const clean = parseDashboardConfig(input);

  const { error } = await ctx.supabase
    .from("organizations")
    .update({ dashboard_config_json: clean as any })
    .eq("id", ctx.organizationId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function resetDashboardConfig(): Promise<SaveDashboardConfigResult> {
  const ctx = await requireOrg();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("organizations")
    .update({ dashboard_config_json: null })
    .eq("id", ctx.organizationId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}
