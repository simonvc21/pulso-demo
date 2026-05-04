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
  thesis?: string | null;
  description?: string | null;
  website?: string | null;
};

export type CreateFundResult = { ok: true; orgId: string } | { ok: false; error: string };

export async function createFund(input: CreateFundInput): Promise<CreateFundResult> {
  if (!input.name.trim()) return { ok: false, error: "Fund name is required" };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const baseSlug = slugify(input.name) || "fund";
  const normUrl = (u: string | null | undefined): string | null => {
    if (!u) return null;
    const t = u.trim();
    if (!t) return null;
    return /^https?:\/\//i.test(t) ? t : `https://${t}`;
  };

  // L.8b — Use the SECURITY DEFINER RPC. The organizations table has no
  // INSERT policy by design (RLS keeps tenants isolated), so a direct
  // insert from a freshly-signed-up user with no org would fail. The RPC
  // creates the org, attaches the caller as GP, and returns the new org id —
  // all atomically, all server-side.
  const { data, error } = await (supabase as any).rpc("create_organization_for_caller", {
    p_name: input.name.trim(),
    p_slug: baseSlug,
    p_vintage: input.vintage,
    p_size_usd: input.sizeUsd,
    p_currency: input.currency || "USD",
    p_thesis: input.thesis?.trim() || null,
    p_description: input.description?.trim() || null,
    p_website: normUrl(input.website),
  });

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Could not create fund" };

  // L.8c — Do NOT revalidate the layout here. The onboarding page itself
  // server-side redirects to /dashboard once profile.organization_id is set,
  // which would bounce the user out of Step 1 → Step 2. The wizard advances
  // client-side; the layout will pick up the new org on the next full nav
  // (when finishOnboarding() finally runs and redirects intentionally).
  return { ok: true, orgId: data as string };
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

// ---------------------------------------------------------------------------
// LPs (Step 2)
// ---------------------------------------------------------------------------

type LpType = Database["public"]["Enums"]["lp_type"];
const VALID_LP_TYPES: LpType[] = ["Family Office", "Institutional", "Fund of Funds", "Individual"];

export type LpDraft = {
  name: string;
  type: LpType;
  commitmentUsd: number;
  country: string | null;
  email: string | null;
};

export type ImportLpsResult = { ok: true; inserted: number } | { ok: false; error: string };

export async function importLps(rows: LpDraft[]): Promise<ImportLpsResult> {
  if (!rows || rows.length === 0) return { ok: false, error: "No LPs provided" };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("users")
    .select("organization_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!profile?.organization_id) return { ok: false, error: "Create your fund first." };
  const orgId = profile.organization_id;

  const inserts = rows
    .filter((r) => r.name.trim().length > 0)
    .map((r) => ({
      organization_id: orgId,
      name: r.name.trim(),
      type: VALID_LP_TYPES.includes(r.type) ? r.type : "Institutional",
      commitment_usd: Math.round(r.commitmentUsd) || 0,
      country: r.country?.toUpperCase() || null,
      email: r.email?.trim().toLowerCase() || null,
    }));

  if (inserts.length === 0) return { ok: false, error: "All rows were empty" };

  const { error } = await supabase.from("lps").insert(inserts);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true, inserted: inserts.length };
}

// ---------------------------------------------------------------------------
// Historical metrics (Step 5)
// ---------------------------------------------------------------------------

export type MetricDraft = {
  companySlug: string;
  quarter: string; // "Q1 2026"
  arrUsd: number | null;
  burnUsd: number | null;
  cashUsd: number | null;
  revenueUsd: number | null;
  headcount: number | null;
};

export type ImportMetricsResult = { ok: true; inserted: number } | { ok: false; error: string };

const QUARTER_RE = /^Q[1-4]\s+\d{4}$/;

export async function importMetrics(rows: MetricDraft[]): Promise<ImportMetricsResult> {
  // L.10/Fase 1.G — onboarding step 5 writes to the company's sheet, not to
  // the legacy metrics table. Each MetricDraft becomes (or updates) a row
  // keyed by the period label, with canonical columns ARR / Burn / Cash /
  // Revenue / Headcount. Re-running the wizard is idempotent.
  if (!rows || rows.length === 0) return { ok: true, inserted: 0 };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("users")
    .select("organization_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!profile?.organization_id) return { ok: false, error: "Create your fund first." };
  const orgId = profile.organization_id;

  const slugs = Array.from(new Set(rows.map((r) => r.companySlug).filter(Boolean)));
  if (slugs.length === 0) return { ok: true, inserted: 0 };

  const { data: companies } = await supabase
    .from("companies")
    .select("id, slug")
    .eq("organization_id", orgId)
    .in("slug", slugs);
  const companyIdBySlug = new Map<string, string>();
  for (const c of companies ?? []) companyIdBySlug.set(c.slug, c.id);

  // Group drafts by company to write each company's sheet in one go.
  const byCompany = new Map<string, MetricDraft[]>();
  for (const r of rows) {
    const cid = companyIdBySlug.get(r.companySlug);
    if (!cid) continue;
    const arr = byCompany.get(cid) ?? [];
    arr.push(r);
    byCompany.set(cid, arr);
  }

  let writtenRows = 0;
  for (const [companyId, drafts] of byCompany.entries()) {
    // Resolve or create the sheet (one-per-company).
    let { data: sheet } = await supabase
      .from("sheets")
      .select("id")
      .eq("company_id", companyId)
      .maybeSingle();
    if (!sheet) {
      const { data: created } = await supabase
        .from("sheets")
        .insert({ company_id: companyId, name: "KPIs", position: 0 })
        .select("id")
        .single();
      sheet = created;
    }
    if (!sheet) continue;
    const sheetId = sheet.id;

    // Ensure the canonical columns exist. Create only the ones we have data for.
    const columnSpecs: Array<{ name: string; type: string; key: keyof MetricDraft }> = [
      { name: "Period",    type: "text",     key: "quarter"   },
      { name: "ARR",       type: "currency", key: "arrUsd"    },
      { name: "Burn",      type: "currency", key: "burnUsd"   },
      { name: "Cash",      type: "currency", key: "cashUsd"   },
      { name: "Revenue",   type: "currency", key: "revenueUsd"},
      { name: "Headcount", type: "number",   key: "headcount" },
    ];

    const { data: existingCols } = await supabase
      .from("sheet_columns")
      .select("id, name, position")
      .eq("sheet_id", sheetId);
    const colByLabel = new Map<string, string>();
    let nextPosition = -1;
    for (const c of existingCols ?? []) {
      colByLabel.set(c.name.toLowerCase().trim(), c.id);
      if (c.position > nextPosition) nextPosition = c.position;
    }

    for (const spec of columnSpecs) {
      const lower = spec.name.toLowerCase();
      if (colByLabel.has(lower)) continue;
      nextPosition += 1;
      const { data: created } = await supabase
        .from("sheet_columns")
        .insert({
          sheet_id: sheetId,
          name: spec.name,
          type: spec.type,
          config: spec.type === "currency" ? { currency: "USD" } : {},
          position: nextPosition,
        } as any)
        .select("id")
        .single();
      if (created) colByLabel.set(lower, created.id);
    }

    const periodColId = colByLabel.get("period")!;
    const colId = (label: string) => colByLabel.get(label.toLowerCase()) ?? null;

    // Existing rows for this sheet so we can upsert by period.
    const { data: existingRows } = await supabase
      .from("sheet_rows")
      .select("id, data, position")
      .eq("sheet_id", sheetId);
    const rowsByPeriod = new Map<string, { id: string; data: any; position: number }>();
    let nextRowPosition = -1;
    for (const r of existingRows ?? []) {
      const data = (r.data ?? {}) as Record<string, any>;
      const periodLabel = String(data[periodColId] ?? "").trim();
      if (periodLabel) rowsByPeriod.set(periodLabel.toLowerCase(), r as any);
      if (r.position > nextRowPosition) nextRowPosition = r.position;
    }

    for (const draft of drafts) {
      const periodLabel = draft.quarter.trim();
      if (!periodLabel) continue;

      // Build the patch. Only set keys for which we have a non-null value.
      const patch: Record<string, any> = { [periodColId]: periodLabel };
      const setIf = (label: string, val: number | null) => {
        if (val == null) return;
        const cid = colId(label);
        if (cid) patch[cid] = val;
      };
      setIf("ARR", draft.arrUsd);
      setIf("Burn", draft.burnUsd);
      setIf("Cash", draft.cashUsd);
      setIf("Revenue", draft.revenueUsd);
      setIf("Headcount", draft.headcount);

      // Skip rows where we'd write nothing besides the period label.
      if (Object.keys(patch).length <= 1) continue;

      const existing = rowsByPeriod.get(periodLabel.toLowerCase());
      if (existing) {
        const merged = { ...((existing.data ?? {}) as Record<string, any>), ...patch };
        const { error } = await supabase
          .from("sheet_rows")
          .update({ data: merged, updated_at: new Date().toISOString() } as any)
          .eq("id", existing.id);
        if (error) return { ok: false, error: error.message };
      } else {
        nextRowPosition += 1;
        const { error } = await supabase
          .from("sheet_rows")
          .insert({ sheet_id: sheetId, data: patch, position: nextRowPosition } as any);
        if (error) return { ok: false, error: error.message };
      }
      writtenRows += 1;
    }
  }

  revalidatePath("/", "layout");
  return { ok: true, inserted: writtenRows };
}

// Helper for the wizard: list companies in org so Step5 can show them.
export type OrgCompanyRef = { id: string; slug: string; name: string };
export async function listOrgCompanies(): Promise<OrgCompanyRef[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: profile } = await supabase
    .from("users")
    .select("organization_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!profile?.organization_id) return [];
  const { data } = await supabase
    .from("companies")
    .select("id, slug, name")
    .eq("organization_id", profile.organization_id)
    .order("name", { ascending: true });
  return (data ?? []) as OrgCompanyRef[];
}

export type FinishOnboardingResult = { ok: true } | { ok: false; error: string };

export async function finishOnboarding(): Promise<FinishOnboardingResult> {
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
