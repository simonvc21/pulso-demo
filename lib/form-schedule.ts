// Client-safe helpers for L.10 form schedules. Pure date math + parsing,
// no Supabase imports — used by both the loader (server) and the calendar
// widget (client).

export type ScheduleCadence = "monthly" | "quarterly" | "annual" | "ad_hoc";

export interface FormSchedule {
  id: string;
  formId: string;
  cadence: ScheduleCadence;
  sendDayOfMonth: number | null;
  anchorMonth: number | null;
  reminderOffsetsDays: number[];
  nextSendAt: string | null;
  lastSentAt: string | null;
  active: boolean;
  /** L.10b — GP-authored invite email subject. Supports {company_name} / {founder_name} / {form_name}. */
  emailSubject: string | null;
  /** L.10b — invite email body. Same placeholders + {form_link} (auto-injected at end if missing). */
  emailBody: string | null;
}

/** Substitute {var} placeholders. Unknown placeholders are left as-is so the
 *  GP can spot typos in the preview. */
export function renderEmailTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, name) => (name in vars ? vars[name] : `{${name}}`));
}

export const DEFAULT_EMAIL_SUBJECT = "{form_name} — {company_name}";
export const DEFAULT_EMAIL_BODY = `Hi {founder_name},

Quick check-in for {company_name}. Please fill in the {form_name} when you have a moment.

{form_link}

Thanks!`;

/**
 * Compute the next time a schedule should fire, given the current time.
 * - monthly: same day-of-month, next month
 * - quarterly: anchorMonth, anchorMonth+3, anchorMonth+6, anchorMonth+9 — pick
 *   the first one >= now
 * - annual: same day-of-month + anchorMonth, next year
 * - ad_hoc: never (returns null)
 */
export function computeNextSendAt(
  cadence: ScheduleCadence,
  sendDayOfMonth: number | null,
  anchorMonth: number | null,
  fromIso: string = new Date().toISOString(),
): string | null {
  if (cadence === "ad_hoc") return null;

  const dom = sendDayOfMonth ?? 1;
  const from = new Date(fromIso);
  // Use UTC throughout to keep things deterministic (Vercel cron is UTC).
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const d = from.getUTCDate();

  if (cadence === "monthly") {
    // This month if dom is in the future, else next month.
    let target = new Date(Date.UTC(y, m, dom, 12, 0, 0));
    if (target.getTime() <= from.getTime()) {
      target = new Date(Date.UTC(y, m + 1, dom, 12, 0, 0));
    }
    return target.toISOString();
  }

  if (cadence === "quarterly") {
    // Anchor month is the FIRST quarter close (e.g. April). Quarters then
    // hit anchor, anchor+3, anchor+6, anchor+9. Find the next one >= now.
    const anchor = (anchorMonth ?? 1) - 1; // 0-indexed
    for (let i = 0; i < 5; i++) {
      const monthIdx = anchor + i * 3;
      const target = new Date(Date.UTC(y, monthIdx, dom, 12, 0, 0));
      if (target.getTime() > from.getTime()) return target.toISOString();
    }
    // Wrap to next year's first quarter close.
    return new Date(Date.UTC(y + 1, anchor, dom, 12, 0, 0)).toISOString();
  }

  if (cadence === "annual") {
    const anchor = (anchorMonth ?? 1) - 1;
    let target = new Date(Date.UTC(y, anchor, dom, 12, 0, 0));
    if (target.getTime() <= from.getTime()) {
      target = new Date(Date.UTC(y + 1, anchor, dom, 12, 0, 0));
    }
    return target.toISOString();
  }

  return null;
}

/**
 * Given a schedule, compute the next N send dates plus the reminder dates
 * that lead up to each send. Useful for the calendar view.
 */
export interface CalendarEvent {
  date: string;          // ISO
  type: "send" | "reminder";
  formId: string;
  formSlug: string;
  formName: string;
  /** For reminders: how many days before the actual send. */
  daysBefore?: number;
}

export function expandSchedule(
  schedule: FormSchedule,
  formName: string,
  formSlug: string,
  count = 6,
  fromIso: string = new Date().toISOString(),
): CalendarEvent[] {
  if (!schedule.active || schedule.cadence === "ad_hoc") return [];

  const events: CalendarEvent[] = [];
  let cursor = fromIso;

  for (let i = 0; i < count; i++) {
    const next = computeNextSendAt(schedule.cadence, schedule.sendDayOfMonth, schedule.anchorMonth, cursor);
    if (!next) break;

    events.push({ date: next, type: "send", formId: schedule.formId, formSlug, formName });

    for (const offset of schedule.reminderOffsetsDays) {
      if (offset <= 0) continue;
      const reminderDate = new Date(new Date(next).getTime() - offset * 24 * 60 * 60 * 1000);
      // Don't surface reminders in the past.
      if (reminderDate.getTime() > new Date(fromIso).getTime()) {
        events.push({
          date: reminderDate.toISOString(),
          type: "reminder",
          formId: schedule.formId,
          formSlug,
          formName,
          daysBefore: offset,
        });
      }
    }

    // Bump cursor by 1 day so we get the *following* occurrence next loop.
    cursor = new Date(new Date(next).getTime() + 24 * 60 * 60 * 1000).toISOString();
  }

  return events;
}

export function isValidDayOfMonth(d: number): boolean {
  return Number.isInteger(d) && d >= 1 && d <= 28;
}

export function isValidMonth(m: number): boolean {
  return Number.isInteger(m) && m >= 1 && m <= 12;
}
