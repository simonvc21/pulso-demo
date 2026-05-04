"use server";

// L.10 / Fase 1.D — Share-link mint + revoke for fund and company dashboards.

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

export type ShareKind = "fund_dashboard" | "company_dashboard";

export type ShareResult =
  | { ok: true; token: string }
  | { ok: false; error: string };

function token(): string {
  return randomBytes(18).toString("base64url");
}

async function getCallerOrgId() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };
  const { data: profile } = await supabase
    .from("users")
    .select("organization_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!profile?.organization_id) return { ok: false as const, error: "No org" };
  return { ok: true as const, supabase, organizationId: profile.organization_id };
}

export async function createShareLink(input: {
  kind: ShareKind;
  /** Required when kind === "company_dashboard". */
  companyId?: string | null;
  /** Optional watermark — surfaced on the public page. */
  watermarkEmail?: string | null;
}): Promise<ShareResult> {
  const ctx = await getCallerOrgId();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  if (input.kind === "company_dashboard" && !input.companyId) {
    return { ok: false, error: "companyId required for company_dashboard" };
  }

  // Verify the company belongs to the caller's org (RLS already does this on
  // insert, but we want to fail fast with a clearer message).
  if (input.companyId) {
    const { data: company } = await ctx.supabase
      .from("companies")
      .select("id")
      .eq("id", input.companyId)
      .maybeSingle();
    if (!company) return { ok: false, error: "Company not found" };
  }

  const t = token();
  const { error } = await ctx.supabase
    .from("share_links")
    .insert({
      organization_id: ctx.organizationId,
      kind: input.kind,
      target_company_id: input.kind === "company_dashboard" ? input.companyId! : null,
      token: t,
      watermark_email: input.watermarkEmail?.trim() || null,
    } as any);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboards");
  return { ok: true, token: t };
}

export async function revokeShareLink(linkId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await getCallerOrgId();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("share_links")
    .delete()
    .eq("id", linkId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboards");
  return { ok: true };
}
