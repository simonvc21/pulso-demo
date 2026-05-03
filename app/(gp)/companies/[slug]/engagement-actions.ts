"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ReactionKind } from "@/lib/lp-engagement";
import { logUsageEvent } from "@/lib/value-analytics";

export type EngagementResult = { ok: true; id?: string } | { ok: false; error: string };

async function requireUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };
  const { data: profile } = await supabase
    .from("users")
    .select("id, organization_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!profile) return { ok: false as const, error: "User row missing" };
  return { ok: true as const, supabase, userId: profile.id, orgId: profile.organization_id };
}

export async function postCompanyComment(input: { companyId: string; body: string }): Promise<EngagementResult> {
  const body = input.body.trim();
  if (!body) return { ok: false, error: "Comment is empty" };
  if (body.length > 2000) return { ok: false, error: "Comment must be ≤ 2000 chars" };

  const ctx = await requireUser();
  if (!ctx.ok) return ctx;

  // Resolve the company slug for revalidation.
  const { data: company } = await ctx.supabase
    .from("companies")
    .select("id, slug")
    .eq("id", input.companyId)
    .maybeSingle();
  if (!company) return { ok: false, error: "Company not found" };

  const { data, error } = await ctx.supabase
    .from("company_comments")
    .insert({ company_id: input.companyId, body, author_user_id: ctx.userId })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };

  revalidatePath(`/companies/${company.slug}`);
  revalidatePath(`/lp/companies/${company.slug}`);

  if (ctx.orgId) {
    await logUsageEvent({
      organizationId: ctx.orgId,
      userId: ctx.userId,
      kind: "company_update_posted",
      metadata: { kind: "comment", company_id: input.companyId },
    });
  }
  return { ok: true, id: data.id };
}

export async function deleteCompanyComment(commentId: string): Promise<EngagementResult> {
  if (!commentId) return { ok: false, error: "Missing id" };
  const ctx = await requireUser();
  if (!ctx.ok) return ctx;

  // Get slug for revalidation.
  const { data: row } = await ctx.supabase
    .from("company_comments")
    .select("companies(slug)")
    .eq("id", commentId)
    .maybeSingle();
  const slug = (row as any)?.companies?.slug;

  const { error } = await ctx.supabase
    .from("company_comments")
    .delete()
    .eq("id", commentId);
  if (error) return { ok: false, error: error.message };

  if (slug) {
    revalidatePath(`/companies/${slug}`);
    revalidatePath(`/lp/companies/${slug}`);
  }
  return { ok: true };
}

export async function toggleCompanyReaction(input: { companyId: string; kind: ReactionKind }): Promise<EngagementResult> {
  if (!input.companyId) return { ok: false, error: "Company id required" };
  const ctx = await requireUser();
  if (!ctx.ok) return ctx;

  // Toggle: delete if exists, insert if not. Use the unique key to avoid races.
  const { data: existing } = await ctx.supabase
    .from("company_reactions")
    .select("id")
    .eq("company_id", input.companyId)
    .eq("user_id", ctx.userId)
    .eq("kind", input.kind)
    .maybeSingle();

  if (existing) {
    const { error } = await ctx.supabase
      .from("company_reactions")
      .delete()
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await ctx.supabase
      .from("company_reactions")
      .insert({ company_id: input.companyId, user_id: ctx.userId, kind: input.kind });
    if (error) return { ok: false, error: error.message };
  }

  // Resolve slug for revalidation.
  const { data: company } = await ctx.supabase
    .from("companies")
    .select("slug")
    .eq("id", input.companyId)
    .maybeSingle();
  if (company?.slug) {
    revalidatePath(`/companies/${company.slug}`);
    revalidatePath(`/lp/companies/${company.slug}`);
  }
  return { ok: true };
}
