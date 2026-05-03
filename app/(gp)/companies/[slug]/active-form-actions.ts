"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActiveFormResult = { ok: true } | { ok: false; error: string };

async function requireGpOrg() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };
  const { data: profile } = await supabase
    .from("users")
    .select("organization_id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!profile?.organization_id) return { ok: false as const, error: "No fund assigned" };
  return { ok: true as const, supabase, organizationId: profile.organization_id, role: profile.role };
}

/** GP override: assign a different form to this company NOW. Marks is_extra=true
 *  so the cron won't overwrite. Cosmetic period_label optional. */
export async function sendExtraForm(input: {
  companyId: string;
  formSlug: string;
  dueInDays?: number;
  periodLabel?: string;
}): Promise<ActiveFormResult> {
  const ctx = await requireGpOrg();
  if (!ctx.ok) return ctx;

  const { data: company } = await ctx.supabase
    .from("companies")
    .select("id, slug")
    .eq("id", input.companyId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!company) return { ok: false, error: "Company not found" };

  const { data: form } = await ctx.supabase
    .from("forms")
    .select("id")
    .eq("slug", input.formSlug)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!form) return { ok: false, error: "Form not found in this fund" };

  const dueAt = input.dueInDays
    ? new Date(Date.now() + input.dueInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  // Upsert by company_id (UNIQUE) — overwrite whatever was active before.
  const { error } = await ctx.supabase
    .from("company_active_form")
    .upsert(
      {
        company_id: input.companyId,
        form_id: form.id,
        due_at: dueAt,
        period_label: input.periodLabel ?? null,
        status: "pending" as const,
        submitted_at: null,
        is_extra: true,
      },
      { onConflict: "company_id" },
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/companies/${company.slug}`);
  revalidatePath(`/lp/companies/${company.slug}`);
  return { ok: true };
}

/** Clear the active form (founder will see "no current form"). */
export async function clearActiveForm(input: { companyId: string }): Promise<ActiveFormResult> {
  const ctx = await requireGpOrg();
  if (!ctx.ok) return ctx;

  const { data: company } = await ctx.supabase
    .from("companies")
    .select("id, slug")
    .eq("id", input.companyId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!company) return { ok: false, error: "Company not found" };

  const { error } = await ctx.supabase
    .from("company_active_form")
    .delete()
    .eq("company_id", input.companyId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/companies/${company.slug}`);
  return { ok: true };
}
