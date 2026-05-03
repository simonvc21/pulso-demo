"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { logUsageEvent } from "@/lib/value-analytics";

type Cadence = Database["public"]["Enums"]["form_cadence"];

export type DraftField = {
  id: string;
  type: "currency" | "number" | "percent" | "text" | "longtext" | "select" | "date" | "news";
  label: string;
  required?: boolean;
  group?: string;
  options?: string[];
};

export type FormInput = {
  name: string;
  cadence: "monthly" | "quarterly" | "annual" | "ad-hoc";
  fields: DraftField[];
  recipientCompanyIds?: string[]; // empty/undefined = "all companies"
};

export type FormResult = { ok: true; slug: string } | { ok: false; error: string };

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function toDbCadence(c: FormInput["cadence"]): Cadence {
  return c === "ad-hoc" ? "ad_hoc" : (c as Cadence);
}

type GpCtx =
  | { ok: false; error: string }
  | { ok: true; supabase: ReturnType<typeof createClient>; organizationId: string };

async function requireGpOrg(): Promise<GpCtx> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: userRow } = await supabase
    .from("users")
    .select("organization_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!userRow?.organization_id) {
    return { ok: false, error: "Your account isn't assigned to a fund yet." };
  }
  return { ok: true, supabase, organizationId: userRow.organization_id };
}

export async function createForm(input: FormInput): Promise<FormResult> {
  if (!input.name.trim()) return { ok: false, error: "Name is required" };
  if (input.fields.length === 0) return { ok: false, error: "Add at least one field" };

  const ctx = await requireGpOrg();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { supabase, organizationId } = ctx;

  const baseSlug = slugify(input.name) || "form";
  let finalSlug = baseSlug;
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await supabase
      .from("forms")
      .select("id")
      .eq("slug", finalSlug)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!existing) break;
    finalSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const { data: inserted, error } = await supabase
    .from("forms")
    .insert({
      organization_id: organizationId,
      slug: finalSlug,
      name: input.name.trim(),
      cadence: toDbCadence(input.cadence),
      fields_json: input.fields as any,
      active: true,
    })
    .select("id")
    .single();

  if (error || !inserted) return { ok: false, error: error?.message ?? "Insert failed" };

  if (input.recipientCompanyIds && input.recipientCompanyIds.length > 0) {
    await supabase.from("form_recipients").insert(
      input.recipientCompanyIds.map((cid) => ({
        form_id: inserted.id,
        company_id: cid,
      }))
    );
  }

  revalidatePath("/forms");
  redirect(`/forms/${finalSlug}`);
}

export async function updateForm(slug: string, input: FormInput): Promise<FormResult> {
  if (!input.name.trim()) return { ok: false, error: "Name is required" };
  if (input.fields.length === 0) return { ok: false, error: "Add at least one field" };

  const ctx = await requireGpOrg();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { supabase, organizationId } = ctx;

  const { data: existing } = await supabase
    .from("forms")
    .select("id, slug")
    .eq("slug", slug)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!existing) return { ok: false, error: "Form not found" };

  const { error } = await supabase
    .from("forms")
    .update({
      name: input.name.trim(),
      cadence: toDbCadence(input.cadence),
      fields_json: input.fields as any,
    })
    .eq("id", existing.id);

  if (error) return { ok: false, error: error.message };

  // Replace recipients atomically: delete + insert.
  if (input.recipientCompanyIds !== undefined) {
    await supabase.from("form_recipients").delete().eq("form_id", existing.id);
    if (input.recipientCompanyIds.length > 0) {
      await supabase.from("form_recipients").insert(
        input.recipientCompanyIds.map((cid) => ({
          form_id: existing.id,
          company_id: cid,
        }))
      );
    }
  }

  revalidatePath("/forms");
  revalidatePath(`/forms/${slug}`);
  redirect(`/forms/${slug}`);
}

// "Send" the form — for the demo this just stamps last_sent_at and bumps
// sent_to_count to the number of active companies in the org.
export async function sendFormNow(slug: string): Promise<FormResult> {
  const ctx = await requireGpOrg();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { supabase, organizationId } = ctx;

  const { data: form } = await supabase
    .from("forms")
    .select("id, slug")
    .eq("slug", slug)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!form) return { ok: false, error: "Form not found" };

  const { count } = await supabase
    .from("companies")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("archived_at", null);

  const { error } = await supabase
    .from("forms")
    .update({
      last_sent_at: new Date().toISOString(),
      sent_to_count: count ?? 0,
    })
    .eq("id", form.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/forms");
  revalidatePath(`/forms/${slug}`);

  // L.20 — emit one event per recipient so the "hours saved" estimate scales
  // (5 min per recipient is the baseline manual cost).
  if (count && count > 0) {
    await logUsageEvent({
      organizationId,
      kind: "form_sent",
      count,
      metadata: { form_slug: slug, form_id: form.id, recipients: count },
    });
  }
  return { ok: true, slug };
}

export async function deactivateForm(slug: string): Promise<FormResult> {
  const ctx = await requireGpOrg();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { supabase, organizationId } = ctx;

  const { error } = await supabase
    .from("forms")
    .update({ active: false })
    .eq("slug", slug)
    .eq("organization_id", organizationId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/forms");
  revalidatePath(`/forms/${slug}`);
  return { ok: true, slug };
}

// ---------------------------------------------------------------------------
// L.10 — Form schedules
// ---------------------------------------------------------------------------

import { computeNextSendAt, type ScheduleCadence, isValidDayOfMonth, isValidMonth } from "@/lib/form-schedule";

export type ScheduleInput = {
  formSlug: string;
  cadence: ScheduleCadence;
  sendDayOfMonth: number | null;
  anchorMonth: number | null;
  reminderOffsetsDays: number[];
  active: boolean;
  /** L.10b — Gmail-style email template for the founder invite. */
  emailSubject?: string | null;
  emailBody?: string | null;
};

export type ScheduleResult = { ok: true } | { ok: false; error: string };

export async function upsertFormSchedule(input: ScheduleInput): Promise<ScheduleResult> {
  if (input.sendDayOfMonth != null && !isValidDayOfMonth(input.sendDayOfMonth)) {
    return { ok: false, error: "Send day must be 1–28" };
  }
  if (input.anchorMonth != null && !isValidMonth(input.anchorMonth)) {
    return { ok: false, error: "Anchor month must be 1–12" };
  }

  const ctx = await requireGpOrg();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  // Resolve form id from slug, scoped to org.
  const { data: form } = await ctx.supabase
    .from("forms")
    .select("id")
    .eq("slug", input.formSlug)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!form) return { ok: false, error: "Form not found" };

  // Compute next_send_at server-side so the calendar query is O(read).
  const nextSendAt = input.active
    ? computeNextSendAt(input.cadence, input.sendDayOfMonth, input.anchorMonth)
    : null;

  // Sanitize reminder offsets — positive ints, deduped, max 5.
  const cleanOffsets = Array.from(new Set(
    input.reminderOffsetsDays
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n > 0 && n <= 90)
  )).slice(0, 5).sort((a, b) => b - a);

  const subject = input.emailSubject?.trim().slice(0, 200) || null;
  const body = input.emailBody?.trim().slice(0, 4000) || null;

  const { error } = await ctx.supabase
    .from("form_schedules")
    .upsert(
      {
        form_id: form.id,
        cadence: input.cadence,
        send_day_of_month: input.sendDayOfMonth,
        anchor_month: input.anchorMonth,
        reminder_offsets_days: cleanOffsets,
        next_send_at: nextSendAt,
        active: input.active,
        email_subject: subject,
        email_body: body,
      } as any,
      { onConflict: "form_id" },
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/forms");
  revalidatePath(`/forms/${input.formSlug}`);
  revalidatePath(`/forms/${input.formSlug}/edit`);
  return { ok: true };
}

export async function pauseFormSchedule(formSlug: string): Promise<ScheduleResult> {
  const ctx = await requireGpOrg();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { data: form } = await ctx.supabase
    .from("forms")
    .select("id")
    .eq("slug", formSlug)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!form) return { ok: false, error: "Form not found" };

  const { error } = await ctx.supabase
    .from("form_schedules")
    .update({ active: false, next_send_at: null })
    .eq("form_id", form.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/forms");
  revalidatePath(`/forms/${formSlug}`);
  return { ok: true };
}

export async function resumeFormSchedule(formSlug: string): Promise<ScheduleResult> {
  const ctx = await requireGpOrg();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { data: form } = await ctx.supabase
    .from("forms")
    .select("id")
    .eq("slug", formSlug)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!form) return { ok: false, error: "Form not found" };

  // Need to re-read the schedule to compute the next send.
  const { data: schedule } = await ctx.supabase
    .from("form_schedules")
    .select("cadence, send_day_of_month, anchor_month")
    .eq("form_id", form.id)
    .maybeSingle();
  if (!schedule) return { ok: false, error: "No schedule to resume" };

  const nextSendAt = computeNextSendAt(
    schedule.cadence as ScheduleCadence,
    schedule.send_day_of_month,
    schedule.anchor_month,
  );

  const { error } = await ctx.supabase
    .from("form_schedules")
    .update({ active: true, next_send_at: nextSendAt })
    .eq("form_id", form.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/forms");
  revalidatePath(`/forms/${formSlug}`);
  return { ok: true };
}
