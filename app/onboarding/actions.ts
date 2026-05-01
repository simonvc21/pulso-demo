"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type Stage = Database["public"]["Enums"]["company_stage"];
type Status = Database["public"]["Enums"]["company_status"];

const VALID_STAGES: Stage[] = ["Pre-seed", "Seed", "Series A", "Series B"];
const VALID_STATUSES: Status[] = ["healthy", "watch", "critical", "no_data"];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export type CreateFundInput = {
  name: string;
  vintage: number | null;
  sizeUsd: number | null;
  currency: string;
};

export type CreateFundResult = { ok: true; orgId: string } | { ok: false; error: string };

export async function createFund(input: CreateFundInput): Promise<CreateFundResult> {
  if (!input.name.trim()) return { ok: false, error: "Fund name is required" };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  // If the user is already in an org, we send them to the dashboard.
  const { data: existing } = await supabase
    .from("users")
    .select("organization_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (existing?.organization_id) {
    return { ok: true, orgId: existing.organization_id };
  }

  // Create the org with a unique slug
  const baseSlug = slugify(input.name) || "fund";
  let finalSlug = baseSlug;
  for (let i = 0; i < 5; i++) {
    const { data: collision } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", finalSlug)
      .maybeSingle();
    if (!collision) break;
    finalSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .insert({
      slug: finalSlug,
      name: input.name.trim(),
      vintage: input.vintage,
      size_usd: input.sizeUsd,
      currency: input.currency || "USD",
    })
    .select("id")
    .single();

  if (orgErr || !org) return { ok: false, error: orgErr?.message ?? "Could not create fund" };

  // Attach the user to the org as GP. The handle_new_user trigger
  // already created public.users when they signed up; we just upgrade.
  if (existing) {
    const { error: linkErr } = await supabase
      .from("users")
      .update({ organization_id: org.id, role: "gp" })
      .eq("auth_user_id", user.id);
    if (linkErr) return { ok: false, error: linkErr.message };
  } else {
    const { error: insErr } = await supabase.from("users").insert({
      auth_user_id: user.id,
      email: user.email ?? "",
      name: (user.user_metadata?.name as string | undefined) ?? null,
      organization_id: org.id,
      role: "gp",
    });
    if (insErr) return { ok: false, error: insErr.message };
  }

  revalidatePath("/", "layout");
  return { ok: true, orgId: org.id };
}

export type CompanyDraft = {
  name: string;
  sector: string | null;
  country: string | null;
  stage: Stage;
  status: Status;
  investedUsd: number;
  ownershipPct: number;
  founderName: string | null;
  founderEmail: string | null;
};

export type ImportCompaniesResult = { ok: true; inserted: number } | { ok: false; error: string };

export async function importCompanies(rows: CompanyDraft[]): Promise<ImportCompaniesResult> {
  if (!rows || rows.length === 0) return { ok: false, error: "No companies provided" };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("users")
    .select("organization_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!profile?.organization_id) {
    return { ok: false, error: "Create your fund first." };
  }

  const orgId = profile.organization_id;

  // Build inserts with unique slugs scoped per org.
  const used = new Set<string>();
  const inserts = rows
    .filter((r) => r.name.trim().length > 0)
    .map((r) => {
      const stage: Stage = VALID_STAGES.includes(r.stage) ? r.stage : "Seed";
      const status: Status = VALID_STATUSES.includes(r.status) ? r.status : "no_data";
      let slug = slugify(r.name) || "company";
      while (used.has(slug)) slug = `${slug}-${Math.random().toString(36).slice(2, 4)}`;
      used.add(slug);
      return {
        organization_id: orgId,
        slug,
        name: r.name.trim(),
        sector: r.sector,
        country: r.country?.toUpperCase() || null,
        stage,
        status,
        invested_usd: Math.round(r.investedUsd) || 0,
        ownership_pct: r.ownershipPct || 0,
        founder_name: r.founderName,
        founder_email: r.founderEmail,
      };
    });

  if (inserts.length === 0) return { ok: false, error: "All rows were empty" };

  const { error } = await supabase.from("companies").insert(inserts);
  if (error) return { ok: false, error: error.message };

  // Update deployed_usd as the sum so the dashboard reflects the import.
  const totalInvested = inserts.reduce((a, x) => a + x.invested_usd, 0);
  await supabase
    .from("organizations")
    .update({ deployed_usd: totalInvested })
    .eq("id", orgId);

  revalidatePath("/", "layout");
  return { ok: true, inserted: inserts.length };
}

export type FinishOnboardingResult = { ok: true } | { ok: false; error: string };

export async function finishOnboarding(): Promise<FinishOnboardingResult> {
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
