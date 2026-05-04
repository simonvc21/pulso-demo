// L.8 — Form email cron. Runs hourly via vercel.json.
//
// Two responsibilities:
//
// 1. Scheduled SENDS — for each form_schedules row where next_send_at <= now()
//    and active=true: assign the form as the company_active_form for every
//    recipient AND email the founders. Then advance next_send_at to the next
//    occurrence (computed via lib/form-schedule).
//
// 2. REMINDERS — for each form_reminders row attached to an active schedule,
//    check whether today is `offset_days` before the next send AND the
//    company hasn't submitted yet. If so, email each founder with that
//    reminder's custom subject/body (or the schedule defaults).
//
// All sends are best-effort. Failures don't roll back DB state — better to
// have a missed email than a stuck schedule.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, renderTemplate, wrapHtmlEmail, isEmailEnabled } from "@/lib/email";
import {
  computeNextSendAt,
  DEFAULT_EMAIL_SUBJECT,
  DEFAULT_EMAIL_BODY,
} from "@/lib/form-schedule";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Cron uses the anon-key client because RLS is bypassed via SECURITY DEFINER
// helpers when needed. Reads here are direct queries — for simplicity, this
// route takes the service role from env. If the env var isn't set, the
// route still runs but only reads data the anon role can see, which means
// schedules in their own org. Vercel Hobby cron auth is via the CRON_SECRET
// header (config below).
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function authorized(req: NextRequest): boolean {
  // Vercel cron sends a Bearer header set to process.env.CRON_SECRET
  // (configured in vercel.json) when invoking. Locally / from the browser
  // there's no auth — useful for manual debugging.
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const got = req.headers.get("authorization");
  return got === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isEmailEnabled()) {
    return NextResponse.json({ ok: true, skipped: "email_not_configured" });
  }

  const sb = admin() as any;
  const now = new Date();
  const todayIso = now.toISOString();

  let invitesSent = 0;
  let remindersSent = 0;
  let advanced = 0;
  const errors: string[] = [];

  // ---------------------- 1. Scheduled SENDS ----------------------
  const { data: dueSchedules } = await sb
    .from("form_schedules")
    .select("form_id, cadence, send_day_of_month, anchor_month, next_send_at, email_subject, email_body, active")
    .eq("active", true)
    .lte("next_send_at", todayIso);

  for (const sch of (dueSchedules ?? [])) {
    try {
      const result = await sendInvitesForForm(sb, sch.form_id, sch.email_subject, sch.email_body);
      invitesSent += result.sent;

      // Advance next_send_at + last_sent_at.
      const next = computeNextSendAt(
        sch.cadence as any,
        sch.send_day_of_month,
        sch.anchor_month,
        // Bump cursor by 1 day so we don't immediately re-fire today.
        new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      );
      await sb.from("form_schedules").update({
        next_send_at: next,
        last_sent_at: todayIso,
      }).eq("form_id", sch.form_id);
      advanced += 1;
    } catch (e: any) {
      errors.push(`form ${sch.form_id} send: ${e?.message ?? e}`);
    }
  }

  // ---------------------- 2. REMINDERS ----------------------
  // Pull every active schedule with reminders. For each, compute target
  // reminder dates (next_send - offset_days) and fire if today matches.
  const { data: activeSchedules } = await sb
    .from("form_schedules")
    .select("form_id, next_send_at, email_subject, email_body, active")
    .eq("active", true)
    .not("next_send_at", "is", null);

  for (const sch of (activeSchedules ?? [])) {
    try {
      const { data: reminders } = await sb
        .from("form_reminders")
        .select("offset_days, subject, body")
        .eq("form_id", sch.form_id);
      if (!reminders || reminders.length === 0) continue;

      const next = new Date(sch.next_send_at);
      for (const r of reminders) {
        const reminderDay = new Date(next.getTime() - r.offset_days * 24 * 60 * 60 * 1000);
        if (!isSameUtcDay(reminderDay, now)) continue;
        const subj = r.subject || sch.email_subject || DEFAULT_EMAIL_SUBJECT;
        const bod  = r.body || sch.email_body || DEFAULT_EMAIL_BODY;
        const sent = await sendInvitesForForm(sb, sch.form_id, subj, bod, { reminder: true, offsetDays: r.offset_days });
        remindersSent += sent.sent;
      }
    } catch (e: any) {
      errors.push(`form ${sch.form_id} reminder: ${e?.message ?? e}`);
    }
  }

  return NextResponse.json({
    ok: true,
    invitesSent,
    remindersSent,
    advanced,
    errors,
  });
}

function isSameUtcDay(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear()
    && a.getUTCMonth() === b.getUTCMonth()
    && a.getUTCDate() === b.getUTCDate();
}

// ---------------------------------------------------------------------------
// Email-sending helper. Resolves recipients, renders the template, and emails
// every active recipient who hasn't submitted yet. Returns count sent.
// ---------------------------------------------------------------------------

async function sendInvitesForForm(
  sb: any,
  formId: string,
  subjectTemplate: string | null,
  bodyTemplate: string | null,
  opts: { reminder?: boolean; offsetDays?: number } = {},
): Promise<{ sent: number }> {
  const [{ data: form }, { data: recipients }] = await Promise.all([
    sb.from("forms").select("id, slug, name, organization_id, organizations(name)").eq("id", formId).maybeSingle(),
    sb.from("form_recipients")
      .select("company_id, founder_emails, founder_email_override, companies(slug, name, founder_name, founder_email, founder_emails)")
      .eq("form_id", formId),
  ]);
  if (!form) return { sent: 0 };

  // For reminders: skip recipients whose company has already submitted this
  // form for the current period (active form status = submitted).
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pulso-demo-three.vercel.app";
  const fundName = (form as any).organizations?.name ?? "Your fund";

  let sent = 0;
  for (const r of (recipients ?? [])) {
    const c = r.companies;
    if (!c) continue;

    // Skip if already submitted (only relevant for reminders, but also a sane guard for resends).
    const { data: active } = await sb.from("company_active_form")
      .select("status")
      .eq("company_id", r.company_id)
      .eq("form_id", formId)
      .maybeSingle();
    if (active?.status === "submitted") continue;

    // For non-reminder (the actual scheduled SEND), upsert the active form so
    // /fill/current resolves correctly.
    if (!opts.reminder) {
      await sb.from("company_active_form").upsert({
        company_id: r.company_id,
        form_id: formId,
        status: "pending" as const,
        submitted_at: null,
        is_extra: false,
      }, { onConflict: "company_id" });
    }

    // Recipient list resolution (matches sendFormInviteEmail logic).
    const recList: string[] = (r.founder_emails ?? []).filter(Boolean);
    const compList: string[] = (c.founder_emails ?? []).filter(Boolean);
    const single = r.founder_email_override ?? c.founder_email ?? null;
    let to: string[] = [];
    if (recList.length > 0) to = recList;
    else if (compList.length > 0) to = compList;
    else if (single) to = [single];
    if (to.length === 0) continue;

    // Founder URL: prefer a token if one exists.
    let founderUrl: string;
    const { data: tokens } = await sb.from("company_fill_tokens")
      .select("token")
      .eq("company_id", r.company_id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1);
    if (tokens && tokens.length > 0) {
      founderUrl = `${baseUrl}/fill/current?token=${tokens[0].token}`;
    } else {
      founderUrl = `${baseUrl}/fill/current?company=${c.slug}`;
    }

    const vars = {
      company_name: c.name,
      founder_name: c.founder_name ?? "team",
      form_name: form.name,
      form_link: founderUrl,
      fund_name: fundName,
      reminder_offset: opts.offsetDays ? `${opts.offsetDays} day${opts.offsetDays === 1 ? "" : "s"}` : "",
    };

    const subj = renderTemplate(subjectTemplate || DEFAULT_EMAIL_SUBJECT, vars);
    const bodyT = bodyTemplate || DEFAULT_EMAIL_BODY;
    const bodyWithLink = bodyT.includes("{form_link}") ? bodyT : `${bodyT.trimEnd()}\n\n{form_link}`;
    const body = renderTemplate(bodyWithLink, vars);

    const html = wrapHtmlEmail({
      fundName,
      body,
      ctaText: `Open ${form.name}`,
      ctaUrl: founderUrl,
    });

    const r2 = await sendEmail({
      to,
      subject: subj,
      html,
      tag: opts.reminder ? "form_reminder" : "form_invite",
    });
    if (r2.ok) sent += 1;
  }

  return { sent };
}
