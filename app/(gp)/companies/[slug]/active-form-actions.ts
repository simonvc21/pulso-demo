"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendEmail, renderTemplate, wrapHtmlEmail, isEmailEnabled } from "@/lib/email";
import { DEFAULT_EMAIL_SUBJECT, DEFAULT_EMAIL_BODY } from "@/lib/form-schedule";

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

  // L.8 — Send invite email to the founder. Best-effort; never fails the
  // upsert above. Caller sees ok:true regardless.
  if (isEmailEnabled()) {
    sendFormInviteEmail({
      supabase: ctx.supabase,
      organizationId: ctx.organizationId,
      formId: form.id,
      formSlug: input.formSlug,
      companyId: input.companyId,
      companySlug: company.slug,
      periodLabel: input.periodLabel ?? null,
    }).catch((e) => console.error("[email] form invite failed", e));
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// L.8 — Form invite email. Resolves the founder emails (per-recipient override
// → company default list → company primary), renders the form's email
// template (or the global default), and includes the founder fill link with
// a fresh token for tracking.
// ---------------------------------------------------------------------------

async function sendFormInviteEmail(opts: {
  supabase: ReturnType<typeof createClient>;
  organizationId: string;
  formId: string;
  formSlug: string;
  companyId: string;
  companySlug: string;
  periodLabel: string | null;
}): Promise<void> {
  const { supabase } = opts;

  // Pull form name + schedule email template (subject/body).
  const [{ data: form }, { data: schedule }, { data: org }, { data: company }, { data: recipient }] = await Promise.all([
    supabase.from("forms").select("name, slug").eq("id", opts.formId).maybeSingle(),
    (supabase as any).from("form_schedules").select("email_subject, email_body").eq("form_id", opts.formId).maybeSingle(),
    supabase.from("organizations").select("name").eq("id", opts.organizationId).maybeSingle(),
    (supabase as any).from("companies")
      .select("name, founder_name, founder_email, founder_emails")
      .eq("id", opts.companyId).maybeSingle(),
    (supabase as any).from("form_recipients")
      .select("founder_emails, founder_email_override")
      .eq("form_id", opts.formId).eq("company_id", opts.companyId).maybeSingle(),
  ]);

  if (!form || !company) return;

  // Effective recipient list: per-recipient list > legacy single override >
  // company.founder_emails > company.founder_email.
  const recList: string[] = (recipient?.founder_emails ?? []).filter(Boolean);
  const compList: string[] = (company.founder_emails ?? []).filter(Boolean);
  const single = recipient?.founder_email_override ?? company.founder_email ?? null;
  let to: string[] = [];
  if (recList.length > 0) to = recList;
  else if (compList.length > 0) to = compList;
  else if (single) to = [single];
  if (to.length === 0) {
    console.warn("[email] form invite skipped — no recipient email", { company: company.name });
    return;
  }

  // Build the founder URL. If the company has any active token, prefer the
  // newest non-revoked one; otherwise fall back to the legacy ?company= URL
  // (still works only when no token has been issued — see L.4e).
  let founderUrl: string;
  const { data: tokens } = await (supabase as any)
    .from("company_fill_tokens")
    .select("token, revoked_at, created_at")
    .eq("company_id", opts.companyId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pulso-demo-three.vercel.app";
  if (tokens && tokens.length > 0) {
    founderUrl = `${baseUrl}/fill/current?token=${tokens[0].token}`;
  } else {
    founderUrl = `${baseUrl}/fill/current?company=${opts.companySlug}`;
  }

  const vars = {
    company_name: company.name,
    founder_name: company.founder_name ?? "team",
    form_name: form.name,
    form_link: founderUrl,
    period_label: opts.periodLabel ?? "",
    fund_name: org?.name ?? "Your fund",
  };

  const subject = renderTemplate(schedule?.email_subject || DEFAULT_EMAIL_SUBJECT, vars);
  const bodyTemplate = schedule?.email_body || DEFAULT_EMAIL_BODY;
  const bodyWithLink = bodyTemplate.includes("{form_link}")
    ? bodyTemplate
    : `${bodyTemplate.trimEnd()}\n\n{form_link}`;
  const body = renderTemplate(bodyWithLink, vars);

  const html = wrapHtmlEmail({
    fundName: org?.name ?? "Pulso",
    body,
    ctaText: `Open ${form.name}`,
    ctaUrl: founderUrl,
  });

  await sendEmail({
    to,
    subject,
    html,
    tag: "form_invite",
  });
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
