"use server";

// L.4e — Per-company fill-token mutations.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireOrg() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };
  const { data: profile } = await supabase
    .from("users")
    .select("id, organization_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!profile?.organization_id) return { ok: false as const, error: "No fund assigned" };
  return { ok: true as const, supabase, organizationId: profile.organization_id };
}

export type GenerateTokenResult =
  | { ok: true; token: string; companySlug: string }
  | { ok: false; error: string };

export async function generateFillToken(input: {
  companyId: string;
  label?: string | null;
}): Promise<GenerateTokenResult> {
  const ctx = await requireOrg();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { data: company } = await ctx.supabase
    .from("companies")
    .select("id, slug")
    .eq("id", input.companyId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!company) return { ok: false, error: "Company not found" };

  const { data, error } = await (ctx.supabase as any).rpc("generate_company_fill_token", {
    p_company_id: input.companyId,
    p_label: input.label ?? null,
  });
  if (error || !data) return { ok: false, error: error?.message ?? "Token generation failed" };

  revalidatePath(`/companies/${company.slug}`);
  return { ok: true, token: data as string, companySlug: company.slug };
}

export type RevokeResult = { ok: true } | { ok: false; error: string };

export async function revokeFillToken(input: {
  tokenId: string;
  companySlug: string;
}): Promise<RevokeResult> {
  const ctx = await requireOrg();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { error } = await (ctx.supabase as any)
    .from("company_fill_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", input.tokenId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/companies/${input.companySlug}`);
  return { ok: true };
}
