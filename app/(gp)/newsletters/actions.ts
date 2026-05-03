"use server";

// L.6 — Newsletter server actions.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildDefaultDraft } from "@/lib/newsletter-draft";
import type { Block, NewsletterCadence, NewsletterStatus } from "@/lib/newsletter";
import { defaultPeriodLabel } from "@/lib/newsletter";
import { getFund } from "@/lib/dashboard-data";

async function requireGp() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };
  const { data: profile } = await supabase
    .from("users")
    .select("id, organization_id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!profile?.organization_id) return { ok: false as const, error: "No fund assigned" };
  if (!["gp", "managing_partner", "partner", "analyst"].includes(profile.role ?? "")) {
    return { ok: false as const, error: "Only GP-side roles can write newsletters" };
  }
  return {
    ok: true as const,
    supabase,
    organizationId: profile.organization_id,
    userId: profile.id,
  };
}

// ---------------------------------------------------------------------------
// Create — auto-drafts from current fund data
// ---------------------------------------------------------------------------

export type CreateInput = {
  cadence: NewsletterCadence;
  periodLabel?: string;          // defaults to current period in the chosen cadence
  autoDraft: boolean;            // false = blank starting point
  /** L.6d — optional GP prompt that steers Overview + Outlook tone via Gemini. */
  prompt?: string;
};

export type CreateResult = { ok: true; id: string } | { ok: false; error: string };

export async function createNewsletter(input: CreateInput): Promise<CreateResult> {
  const ctx = await requireGp();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const fund = await getFund();
  const fundName = fund?.name ?? "Your fund";
  const periodLabel = input.periodLabel?.trim() || defaultPeriodLabel(input.cadence);

  let coverTitle = `${fundName} — ${periodLabel}`;
  let coverSubtitle: string | null = null;
  let heroMetricSummary: string | null = null;
  let blocks: Block[] = [];

  if (input.autoDraft) {
    const draft = await buildDefaultDraft({
      organizationId: ctx.organizationId,
      periodLabel,
      cadence: input.cadence,
      fundName,
      prompt: input.prompt?.trim() || undefined,
    });
    coverTitle = draft.coverTitle;
    coverSubtitle = draft.coverSubtitle;
    heroMetricSummary = draft.heroMetricSummary;
    blocks = draft.blocks;
  }

  const { data, error } = await (ctx.supabase as any)
    .from("newsletters")
    .insert({
      organization_id: ctx.organizationId,
      period_label: periodLabel,
      cadence: input.cadence,
      status: "draft" as NewsletterStatus,
      cover_title: coverTitle,
      cover_subtitle: coverSubtitle,
      hero_metric_summary: heroMetricSummary,
      sections_json: blocks,
      created_by_user_id: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };

  revalidatePath("/newsletters");
  return { ok: true, id: data.id };
}

// ---------------------------------------------------------------------------
// Save (draft persistence — title / subtitle / blocks)
// ---------------------------------------------------------------------------

export type SaveInput = {
  id: string;
  coverTitle: string;
  coverSubtitle: string | null;
  heroMetricSummary: string | null;
  periodLabel: string;
  cadence: NewsletterCadence;
  blocks: Block[];
};

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function saveNewsletter(input: SaveInput): Promise<SaveResult> {
  const ctx = await requireGp();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { error } = await (ctx.supabase as any)
    .from("newsletters")
    .update({
      cover_title: input.coverTitle.trim().slice(0, 200),
      cover_subtitle: input.coverSubtitle?.trim().slice(0, 300) || null,
      hero_metric_summary: input.heroMetricSummary?.trim().slice(0, 200) || null,
      period_label: input.periodLabel.trim().slice(0, 60),
      cadence: input.cadence,
      sections_json: input.blocks,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("organization_id", ctx.organizationId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/newsletters");
  revalidatePath(`/newsletters/${input.id}`);
  revalidatePath(`/newsletters/${input.id}/edit`);
  revalidatePath("/lp");
  revalidatePath("/lp/newsletters");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Publish / unpublish / delete
// ---------------------------------------------------------------------------

export async function publishNewsletter(id: string): Promise<SaveResult> {
  const ctx = await requireGp();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { error } = await (ctx.supabase as any)
    .from("newsletters")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      published_by_user_id: ctx.userId,
    })
    .eq("id", id)
    .eq("organization_id", ctx.organizationId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/newsletters");
  revalidatePath(`/newsletters/${id}`);
  revalidatePath("/lp");
  revalidatePath("/lp/newsletters");
  return { ok: true };
}

export async function unpublishNewsletter(id: string): Promise<SaveResult> {
  const ctx = await requireGp();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { error } = await (ctx.supabase as any)
    .from("newsletters")
    .update({ status: "draft", published_at: null, published_by_user_id: null })
    .eq("id", id)
    .eq("organization_id", ctx.organizationId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/newsletters");
  revalidatePath(`/newsletters/${id}`);
  revalidatePath("/lp");
  revalidatePath("/lp/newsletters");
  return { ok: true };
}

export async function deleteNewsletter(id: string): Promise<SaveResult> {
  const ctx = await requireGp();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { error } = await (ctx.supabase as any)
    .from("newsletters")
    .delete()
    .eq("id", id)
    .eq("organization_id", ctx.organizationId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/newsletters");
  redirect("/newsletters");
}
