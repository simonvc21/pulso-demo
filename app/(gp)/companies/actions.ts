"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type Stage = Database["public"]["Enums"]["company_stage"];
type Status = Database["public"]["Enums"]["company_status"];
type Instrument = Database["public"]["Enums"]["investment_instrument"];

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
  // L.6 — investment terms + links
  investmentInstrument: Instrument | null;
  safeCapUsd: number | null;
  safeDiscountPct: number | null;
  website: string | null;
  linkedinUrl: string | null;
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

  const { error } = await supabase
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
      founder_email: input.founder.email,
      founder_role: input.founder.role,
      investment_instrument: input.investmentInstrument,
      safe_cap_usd: input.safeCapUsd,
      safe_discount_pct: input.safeDiscountPct,
      website: normalizeUrl(input.website),
      linkedin_url: normalizeUrl(input.linkedinUrl),
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

  const { error } = await supabase.from("companies").insert({
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
    founder_email: input.founder.email,
    founder_role: input.founder.role,
    investment_instrument: input.investmentInstrument,
    safe_cap_usd: input.safeCapUsd,
    safe_discount_pct: input.safeDiscountPct,
    website: normalizeUrl(input.website),
    linkedin_url: normalizeUrl(input.linkedinUrl),
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/companies");
  revalidatePath("/dashboard");
  redirect(`/companies/${finalSlug}`);
}
