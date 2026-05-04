"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { logUsageEvent } from "@/lib/value-analytics";
import { periodColumnsFromQuarterString } from "@/lib/period";

type Stage = Database["public"]["Enums"]["company_stage"];
type Status = Database["public"]["Enums"]["company_status"];
type Instrument = Database["public"]["Enums"]["investment_instrument"];
type TrackingCadenceDb = Database["public"]["Enums"]["tracking_cadence"];

export type CompanyInput = {
  name: string;
  sector: string | null;
  country: string | null;
  stage: Stage;
  status: Status;
  flag: string | null;
  description: string | null;
  investedUsd: number;
  ownershipPct: number;
  founder: { name: string | null; email: string | null; role: string | null };
  /** L.5d — additional founder emails. Replaces founder_email when present. */
  founderEmails?: string[];
  // L.6 — investment terms + links
  investmentInstrument: Instrument | null;
  safeCapUsd: number | null;
  safeDiscountPct: number | null;
  website: string | null;
  linkedinUrl: string | null;
  // L.12 — per-company tracking cadence (monthly default)
  trackingCadence: TrackingCadenceDb;
};

function normalizeUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  const t = u.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

export type CompanyResult = { ok: true; slug: string } | { ok: false; error: string };

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function requireOrg() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };
  const { data: row } = await supabase
    .from("users")
    .select("organization_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!row?.organization_id) return { ok: false as const, error: "No fund assigned to your account." };
  return { ok: true as const, supabase, organizationId: row.organization_id };
}

export async function updateCompany(slug: string, input: CompanyInput): Promise<CompanyResult> {
  if (!input.name.trim()) return { ok: false, error: "Name is required" };

  const ctx = await requireOrg();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { supabase, organizationId } = ctx;

  const { data: existing } = await supabase
    .from("companies")
    .select("id, slug")
    .eq("slug", slug)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Company not found" };

  // L.5d — sanitize the multi-email array.
  const cleanFounderEmails = (input.founderEmails ?? [])
    .map((e) => e.trim())
    .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
  // Keep founder_email in sync as the primary contact (first in the list,
  // else the legacy single field).
  const primaryEmail = cleanFounderEmails[0] ?? input.founder.email ?? null;

  const { error } = await (supabase as any)
    .from("companies")
    .update({
      name: input.name.trim(),
      sector: input.sector,
      country: input.country?.toUpperCase() || null,
      stage: input.stage,
      status: input.status,
      flag: input.flag,
      description: input.description,
      invested_usd: Math.round(input.investedUsd),
      ownership_pct: input.ownershipPct,
      founder_name: input.founder.name,
      founder_email: primaryEmail,
      founder_emails: cleanFounderEmails,
      founder_role: input.founder.role,
      investment_instrument: input.investmentInstrument,
      safe_cap_usd: input.safeCapUsd,
      safe_discount_pct: input.safeDiscountPct,
      website: normalizeUrl(input.website),
      linkedin_url: normalizeUrl(input.linkedinUrl),
      tracking_cadence: input.trackingCadence,
    })
    .eq("id", existing.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/companies");
  revalidatePath(`/companies/${slug}`);
  revalidatePath("/dashboard");
  return { ok: true, slug };
}

export async function createCompany(input: CompanyInput): Promise<CompanyResult> {
  if (!input.name.trim()) return { ok: false, error: "Name is required" };

  const ctx = await requireOrg();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { supabase, organizationId } = ctx;

  const baseSlug = slugify(input.name) || "company";
  let finalSlug = baseSlug;
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await supabase
      .from("companies")
      .select("id")
      .eq("slug", finalSlug)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!existing) break;
    finalSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const cleanFounderEmails = (input.founderEmails ?? [])
    .map((e) => e.trim())
    .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
  const primaryEmail = cleanFounderEmails[0] ?? input.founder.email ?? null;

  const { error } = await (supabase as any).from("companies").insert({
    organization_id: organizationId,
    slug: finalSlug,
    name: input.name.trim(),
    sector: input.sector,
    country: input.country?.toUpperCase() || null,
    stage: input.stage,
    status: input.status,
    flag: input.flag,
    description: input.description,
    invested_usd: Math.round(input.investedUsd),
    ownership_pct: input.ownershipPct,
    founder_name: input.founder.name,
    founder_email: primaryEmail,
    founder_emails: cleanFounderEmails,
    founder_role: input.founder.role,
    investment_instrument: input.investmentInstrument,
    safe_cap_usd: input.safeCapUsd,
    safe_discount_pct: input.safeDiscountPct,
    website: normalizeUrl(input.website),
    linkedin_url: normalizeUrl(input.linkedinUrl),
    tracking_cadence: input.trackingCadence,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/companies");
  revalidatePath("/dashboard");
  redirect(`/companies/${finalSlug}`);
}

// ---------------------------------------------------------------------------
// Company updates (manual GP notes — feed on /companies/[slug])
// ---------------------------------------------------------------------------

export type AddCompanyUpdateResult = { ok: true; id: string } | { ok: false; error: string };

export async function addCompanyUpdate(input: { companyId: string; body: string }): Promise<AddCompanyUpdateResult> {
  const body = input.body.trim();
  if (!body) return { ok: false, error: "Update text is required" };
  if (body.length > 4000) return { ok: false, error: "Update must be ≤ 4000 chars" };

  const ctx = await requireOrg();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  // Verify the company is in the caller's org. RLS would catch this but
  // we also need the slug for revalidation.
  const { data: company } = await ctx.supabase
    .from("companies")
    .select("id, slug")
    .eq("id", input.companyId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!company) return { ok: false, error: "Company not found" };

  // Need the public.users.id (not auth.users.id) for author_user_id.
  const { data: { user } } = await ctx.supabase.auth.getUser();
  let authorUserId: string | null = null;
  if (user) {
    const { data: profile } = await ctx.supabase
      .from("users")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    authorUserId = profile?.id ?? null;
  }

  const { data, error } = await ctx.supabase
    .from("company_updates")
    .insert({ company_id: input.companyId, body, author_user_id: authorUserId })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };

  revalidatePath(`/companies/${company.slug}`);
  // L.20 — track team-update posts (cheap heuristic, included for completeness).
  await logUsageEvent({
    organizationId: ctx.organizationId,
    userId: authorUserId,
    kind: "company_update_posted",
    metadata: { company_id: input.companyId, slug: company.slug },
  });
  return { ok: true, id: data.id };
}

export type DeleteCompanyUpdateResult = { ok: true } | { ok: false; error: string };

export async function deleteCompanyUpdate(updateId: string): Promise<DeleteCompanyUpdateResult> {
  if (!updateId) return { ok: false, error: "Missing id" };
  const ctx = await requireOrg();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  // Get the company slug for revalidation.
  const { data: row } = await ctx.supabase
    .from("company_updates")
    .select("companies(slug)")
    .eq("id", updateId)
    .maybeSingle();
  const slug = (row as any)?.companies?.slug;

  const { error } = await ctx.supabase
    .from("company_updates")
    .delete()
    .eq("id", updateId);
  if (error) return { ok: false, error: error.message };

  if (slug) revalidatePath(`/companies/${slug}`);
  return { ok: true };
}


// ---------------------------------------------------------------------------
// L.4c — Soft-delete (archive) for companies
// ---------------------------------------------------------------------------

export type ArchiveResult = { ok: true } | { ok: false; error: string };

export async function archiveCompany(slug: string): Promise<ArchiveResult> {
  const ctx = await requireOrg();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { error } = await ctx.supabase
    .from("companies")
    .update({ archived_at: new Date().toISOString() } as any)
    .eq("slug", slug)
    .eq("organization_id", ctx.organizationId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/companies");
  revalidatePath("/dashboard");
  revalidatePath(`/companies/${slug}`);
  return { ok: true };
}

export async function unarchiveCompany(slug: string): Promise<ArchiveResult> {
  const ctx = await requireOrg();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { error } = await ctx.supabase
    .from("companies")
    .update({ archived_at: null } as any)
    .eq("slug", slug)
    .eq("organization_id", ctx.organizationId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/companies");
  revalidatePath("/dashboard");
  revalidatePath(`/companies/${slug}`);
  return { ok: true };
}
