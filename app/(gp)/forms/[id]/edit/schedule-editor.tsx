"use client";

import { useState, useTransition } from "react";
import {
  Calendar, Loader2, Check, AlertCircle, Pause, Play, Plus, X, Mail, RotateCcw,
  Trash2, ChevronDown, ChevronRight, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  upsertFormSchedule,
  pauseFormSchedule,
  resumeFormSchedule,
  setFormRecipients,
} from "../../actions";
import {
  computeNextSendAt,
  renderEmailTemplate,
  DEFAULT_EMAIL_SUBJECT,
  DEFAULT_EMAIL_BODY,
  type ScheduleCadence,
  type FormSchedule,
  type FormReminder,
  type FormRecipient,
} from "@/lib/form-schedule";

interface Props {
  formSlug: string;
  formName: string;
  initial: FormSchedule | null;
  /** L.5b — per-reminder copy. */
  initialReminders?: FormReminder[];
  /** L.5b — recipient list with per-row email override. */
  initialRecipients?: FormRecipient[];
  /** L.5b — every company in the org so the GP can add new recipients. */
  allCompanies?: { id: string; slug: string; name: string; founderEmail: string | null }[];
}

const CADENCE_OPTIONS: { value: ScheduleCadence; label: string; hint: string }[] = [
  { value: "monthly", label: "Monthly", hint: "Sends on the same day of every month" },
  { value: "quarterly", label: "Quarterly", hint: "Sends 4× a year, anchored to your fiscal quarter close" },
  { value: "annual", label: "Annual", hint: "Sends once a year on a specific month + day" },
  { value: "ad_hoc", label: "Ad-hoc (manual)", hint: "No automatic sends — only when you click Send now" },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const COMMON_OFFSETS = [1, 2, 3, 7, 14];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type DraftReminder = { offsetDays: number; subject: string | null; body: string | null };

export function ScheduleEditor({
  formSlug, formName, initial, initialReminders, initialRecipients, allCompanies,
}: Props) {
  // L.12c — defaults for monthly cadence: 5th of every month + reminders 3
  // and 1 days before the send (tighter window than quarterly's 7+2).
  const [cadence, setCadence] = useState<ScheduleCadence>(initial?.cadence ?? "monthly");
  const [sendDayOfMonth, setSendDayOfMonth] = useState<number>(initial?.sendDayOfMonth ?? 5);
  const [anchorMonth, setAnchorMonth] = useState<number>(initial?.anchorMonth ?? 1);
  // L.5b — full reminder objects (offset + custom copy each).
  const [reminders, setReminders] = useState<DraftReminder[]>(
    (initialReminders && initialReminders.length > 0)
      ? initialReminders.map((r) => ({ offsetDays: r.offsetDays, subject: r.subject, body: r.body }))
      : (initial?.reminderOffsetsDays ?? [3, 1]).map((d) => ({ offsetDays: d, subject: null, body: null }))
  );
  const [active, setActive] = useState<boolean>(initial?.active ?? true);
  const [emailSubject, setEmailSubject] = useState<string>(initial?.emailSubject ?? DEFAULT_EMAIL_SUBJECT);
  const [emailBody, setEmailBody] = useState<string>(initial?.emailBody ?? DEFAULT_EMAIL_BODY);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Derived for legacy code paths (calendar preview).
  const reminderOffsets = reminders.map((r) => r.offsetDays).sort((a, b) => b - a);

  // Live preview of next send
  const previewNext = computeNextSendAt(cadence, sendDayOfMonth, anchorMonth);

  const showDay = cadence !== "ad_hoc";
  const showMonth = cadence === "quarterly" || cadence === "annual";

  function addReminder() {
    setReminders((prev) => {
      const used = new Set(prev.map((r) => r.offsetDays));
      const candidate = [14, 7, 3, 1].find((d) => !used.has(d)) ?? prev.length + 1;
      return [...prev, { offsetDays: candidate, subject: null, body: null }]
        .sort((a, b) => b.offsetDays - a.offsetDays);
    });
  }

  function removeReminder(idx: number) {
    setReminders((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateReminder(idx: number, patch: Partial<DraftReminder>) {
    setReminders((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r))
        .sort((a, b) => b.offsetDays - a.offsetDays)
    );
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await upsertFormSchedule({
        formSlug,
        cadence,
        sendDayOfMonth: showDay ? sendDayOfMonth : null,
        anchorMonth: showMonth ? anchorMonth : null,
        reminders,
        active,
        emailSubject,
        emailBody,
      });
      if (!res.ok) { setError(res.error); return; }
      setSavedAt(Date.now());
    });
  }

  function resetEmailTemplate() {
    setEmailSubject(DEFAULT_EMAIL_SUBJECT);
    setEmailBody(DEFAULT_EMAIL_BODY);
  }

  // Live preview vars — sample values for the GP to see what founders will get.
  const previewVars = {
    company_name: "Acme",
    founder_name: "Diego Mendoza",
    form_name: formName,
    form_link: typeof window !== "undefined"
      ? `${window.location.origin}/fill/${formSlug}?company=acme`
      : `https://pulso-demo-three.vercel.app/fill/${formSlug}?company=acme`,
  };
  // Auto-append {form_link} if the body doesn't include it (so founders always
  // get a link).
  const bodyWithLink = emailBody.includes("{form_link}")
    ? emailBody
    : `${emailBody.trimEnd()}\n\n{form_link}`;
  const previewSubject = renderEmailTemplate(emailSubject, previewVars);
  const previewBody = renderEmailTemplate(bodyWithLink, previewVars);

  function pause() {
    setError(null);
    startTransition(async () => {
      const res = await pauseFormSchedule(formSlug);
      if (!res.ok) { setError(res.error); return; }
      setActive(false);
      setSavedAt(Date.now());
    });
  }

  function resume() {
    setError(null);
    startTransition(async () => {
      const res = await resumeFormSchedule(formSlug);
      if (!res.ok) { setError(res.error); return; }
      setActive(true);
      setSavedAt(Date.now());
    });
  }

  return (
    <div className="bg-white rounded-xl border border-line shadow-card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-[10px] tracking-[0.16em] uppercase text-muted font-semibold inline-flex items-center gap-1.5">
            <Calendar className="h-3 w-3" /> Schedule
          </h3>
          <p className="text-[11px] text-muted mt-0.5">
            When this form auto-sends + when reminders go out. Email delivery ships in Phase C — this is the calendar intent.
          </p>
        </div>
        {initial?.active ? (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={pause} disabled={pending}>
            <Pause className="h-3.5 w-3.5" /> Pause
          </Button>
        ) : initial ? (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={resume} disabled={pending}>
            <Play className="h-3.5 w-3.5" /> Resume
          </Button>
        ) : null}
      </div>

      {/* Cadence picker */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {CADENCE_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setCadence(o.value)}
            className={cn(
              "rounded-lg border px-3 py-2.5 text-left transition-colors",
              cadence === o.value
                ? "border-navy bg-navy/5 text-navy"
                : "border-line text-muted hover:border-navy/40 hover:text-ink"
            )}
          >
            <div className="text-sm font-semibold">{o.label}</div>
            <div className="text-[10px] mt-0.5 leading-tight">{o.hint}</div>
          </button>
        ))}
      </div>

      {/* Day + month row */}
      {(showDay || showMonth) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {showMonth && (
            <label className="block">
              <span className="block text-[10px] font-semibold text-ink tracking-[0.14em] uppercase mb-1">
                {cadence === "quarterly" ? "Q1 close month" : "Month"}
              </span>
              <select
                value={anchorMonth}
                onChange={(e) => setAnchorMonth(parseInt(e.target.value, 10))}
                className="w-full h-10 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </label>
          )}
          {showDay && (
            <label className="block">
              <span className="block text-[10px] font-semibold text-ink tracking-[0.14em] uppercase mb-1">
                Day of month
              </span>
              <input
                type="number"
                min={1}
                max={28}
                value={sendDayOfMonth}
                onChange={(e) => setSendDayOfMonth(Math.max(1, Math.min(28, parseInt(e.target.value, 10) || 1)))}
                className="w-full h-10 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 tabular-nums"
              />
              <span className="block text-[10px] text-muted mt-1">1–28 (avoids month-end edge cases)</span>
            </label>
          )}
        </div>
      )}

      {/* L.5b — Per-reminder editor: list, custom day offsets, custom copy. */}
      {cadence !== "ad_hoc" && (
        <div className="mb-4 border border-line rounded-lg p-3 bg-paper2/30">
          <div className="flex items-center justify-between mb-2">
            <span className="block text-[10px] font-semibold text-ink tracking-[0.14em] uppercase">
              Reminders
            </span>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={addReminder} disabled={reminders.length >= 8}>
              <Plus className="h-3.5 w-3.5" /> Add reminder
            </Button>
          </div>
          {reminders.length === 0 ? (
            <p className="text-[11px] text-muted">No reminders. Founders only get the initial send.</p>
          ) : (
            <ul className="space-y-2">
              {reminders.map((r, i) => (
                <ReminderRow
                  key={i}
                  reminder={r}
                  onChange={(patch) => updateReminder(i, patch)}
                  onRemove={() => removeReminder(i)}
                  fallbackSubject={emailSubject}
                  fallbackBody={emailBody}
                  previewVars={{
                    company_name: "Acme",
                    founder_name: "Diego Mendoza",
                    form_name: formName,
                    form_link: typeof window !== "undefined"
                      ? `${window.location.origin}/fill/current?token=…`
                      : `https://pulso-demo-three.vercel.app/fill/current?token=…`,
                  }}
                />
              ))}
            </ul>
          )}
          <p className="text-[10px] text-muted mt-2">
            Each reminder fires N days before the next scheduled send. Leave subject/body empty to use the initial-send template.
          </p>
        </div>
      )}

      {/* Live preview */}
      {previewNext && (
        <div className="rounded-lg border border-teal/30 bg-teal/5 px-3 py-2 mb-4 text-[12px]">
          <div className="text-teal-600 font-semibold inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> Next send
          </div>
          <div className="text-ink mt-0.5">{formatDate(previewNext)}</div>
          {reminderOffsets.length > 0 && (
            <div className="text-muted text-[11px] mt-0.5">
              Reminders: {reminderOffsets.map((d) => {
                const dt = new Date(new Date(previewNext).getTime() - d * 24 * 60 * 60 * 1000);
                return formatDate(dt.toISOString());
              }).join(" · ")}
            </div>
          )}
        </div>
      )}

      {/* Email template — Gmail-style subject + body with placeholders */}
      <div className="border-t border-line pt-4 mb-4">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <div>
            <span className="text-[10px] font-semibold text-ink tracking-[0.14em] uppercase inline-flex items-center gap-1.5">
              <Mail className="h-3 w-3" /> Email to founder
            </span>
            <p className="text-[11px] text-muted mt-0.5">
              Use <code className="bg-paper2 px-1 rounded">{"{company_name}"}</code>, <code className="bg-paper2 px-1 rounded">{"{founder_name}"}</code>, <code className="bg-paper2 px-1 rounded">{"{form_name}"}</code>, <code className="bg-paper2 px-1 rounded">{"{form_link}"}</code>. Pulso fills them per recipient. The form link is auto-added if you forget it.
            </p>
          </div>
          <button
            type="button"
            onClick={resetEmailTemplate}
            className="text-[11px] text-muted hover:text-navy inline-flex items-center gap-1 shrink-0"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-muted tracking-[0.14em] uppercase mb-1">Subject</label>
            <input
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              maxLength={200}
              className="w-full h-10 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
            />
            <label className="block text-[10px] font-semibold text-muted tracking-[0.14em] uppercase mb-1 mt-3">Body</label>
            <textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              rows={8}
              maxLength={4000}
              className="w-full px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 resize-none font-mono"
            />
            <div className="text-[10px] text-muted mt-0.5 text-right">{emailBody.length} / 4000</div>
          </div>

          {/* Live preview — what the founder actually sees */}
          <div className="rounded-lg border border-line bg-paper2/40 p-3 text-[12px]">
            <div className="text-[10px] tracking-[0.14em] uppercase text-muted font-semibold mb-1">Preview (sample values)</div>
            <div className="bg-white rounded-md border border-line p-3">
              <div className="text-[10px] text-muted">Subject</div>
              <div className="text-sm font-semibold text-ink mb-2">{previewSubject}</div>
              <div className="border-t border-line pt-2">
                <pre className="text-[12px] text-ink whitespace-pre-wrap leading-relaxed font-sans">{previewBody}</pre>
              </div>
            </div>
            <div className="text-[10px] text-muted mt-2">
              Sample uses <strong>Acme</strong> / <strong>Diego Mendoza</strong>. Real sends use each recipient's data.
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-coral/30 bg-coral/10 text-coral px-3 py-1.5 text-[11px] mb-3 flex items-center gap-1.5">
          <AlertCircle className="h-3 w-3" /> {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        {savedAt && (
          <span className="text-[11px] text-teal-600 inline-flex items-center gap-1.5">
            <Check className="h-3 w-3" /> Saved
          </span>
        )}
        <div className="ml-auto">
          <Button variant="gold" size="sm" className="gap-1.5" onClick={save} disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Save schedule
          </Button>
        </div>
      </div>

      <p className="text-[10px] text-muted mt-3">
        Note: emails fire when Phase C (Resend integration) ships. The schedule is saved and the calendar updates immediately.
      </p>

      {/* L.5b — Recipients table sits at the bottom because it depends on the
          schedule existing first. Saved independently so adding a recipient
          doesn't bounce the cadence work. */}
      {allCompanies && (
        <div className="mt-6 pt-5 border-t border-line">
          <RecipientsEditor
            formSlug={formSlug}
            allCompanies={allCompanies}
            initial={initialRecipients ?? []}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// L.5b — ReminderRow: collapsible per-reminder editor.
// ---------------------------------------------------------------------------

function ReminderRow({
  reminder, onChange, onRemove, fallbackSubject, fallbackBody, previewVars,
}: {
  reminder: DraftReminder;
  onChange: (patch: Partial<DraftReminder>) => void;
  onRemove: () => void;
  fallbackSubject: string;
  fallbackBody: string;
  previewVars: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const usingFallback = !reminder.subject && !reminder.body;

  return (
    <li className="rounded-md border border-line bg-white">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-muted hover:text-ink shrink-0"
          aria-label={open ? "Collapse" : "Expand"}
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <input
          type="number"
          min={1}
          max={60}
          value={reminder.offsetDays}
          onChange={(e) => onChange({ offsetDays: Math.max(1, Math.min(60, parseInt(e.target.value, 10) || 1)) })}
          className="h-8 w-16 px-2 rounded-md border border-line text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-teal/30"
        />
        <span className="text-[12px] text-ink">day{reminder.offsetDays === 1 ? "" : "s"} before send</span>
        <span className={cn(
          "ml-auto text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded",
          usingFallback ? "bg-paper2 text-muted" : "bg-teal-50 text-teal-600 font-semibold",
        )}>
          {usingFallback ? "Default copy" : "Custom copy"}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-muted hover:text-coral p-1"
          aria-label="Remove reminder"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {open && (
        <div className="border-t border-line px-3 py-3 space-y-2 bg-paper2/40">
          <label className="block">
            <span className="block text-[10px] font-semibold text-muted tracking-[0.14em] uppercase mb-1">
              Subject (optional, defaults to initial send)
            </span>
            <input
              value={reminder.subject ?? ""}
              onChange={(e) => onChange({ subject: e.target.value || null })}
              placeholder={fallbackSubject}
              maxLength={200}
              className="w-full h-9 px-2.5 rounded-md border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
            />
          </label>
          <label className="block">
            <span className="block text-[10px] font-semibold text-muted tracking-[0.14em] uppercase mb-1">
              Body (optional)
            </span>
            <textarea
              value={reminder.body ?? ""}
              onChange={(e) => onChange({ body: e.target.value || null })}
              placeholder={fallbackBody}
              rows={4}
              maxLength={4000}
              className="w-full px-2.5 py-2 rounded-md border border-line text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal/30 resize-none"
            />
          </label>
          <div className="text-[10px] text-muted">
            Placeholders: <code className="bg-white px-1 rounded">{"{company_name}"}</code>, <code className="bg-white px-1 rounded">{"{founder_name}"}</code>, <code className="bg-white px-1 rounded">{"{form_name}"}</code>, <code className="bg-white px-1 rounded">{"{form_link}"}</code>.
          </div>
          {(reminder.subject || reminder.body) && (
            <div className="rounded border border-line bg-white p-2 text-[11px]">
              <div className="text-muted mb-0.5">Preview ({previewVars.company_name})</div>
              <div className="font-semibold text-ink">{renderEmailTemplate(reminder.subject || fallbackSubject, previewVars)}</div>
              <pre className="mt-1 whitespace-pre-wrap font-sans text-ink">{renderEmailTemplate(reminder.body || fallbackBody, previewVars)}</pre>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// L.5b — RecipientsEditor: per-company picker with founder email override.
// ---------------------------------------------------------------------------

type AllCompany = { id: string; slug: string; name: string; founderEmail: string | null };
type DraftRecipient = { companyId: string; founderEmailOverride: string | null };

function RecipientsEditor({
  formSlug, allCompanies, initial,
}: {
  formSlug: string;
  allCompanies: AllCompany[];
  initial: FormRecipient[];
}) {
  const [recipients, setRecipients] = useState<DraftRecipient[]>(
    initial.map((r) => ({ companyId: r.companyId, founderEmailOverride: r.founderEmailOverride }))
  );
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byId = new Map(allCompanies.map((c) => [c.id, c]));
  const recipientIds = new Set(recipients.map((r) => r.companyId));
  const available = allCompanies.filter((c) => !recipientIds.has(c.id));

  function add(id: string) {
    setRecipients((prev) => [...prev, { companyId: id, founderEmailOverride: null }]);
  }
  function remove(id: string) {
    setRecipients((prev) => prev.filter((r) => r.companyId !== id));
  }
  function setOverride(id: string, value: string) {
    setRecipients((prev) =>
      prev.map((r) => (r.companyId === id ? { ...r, founderEmailOverride: value || null } : r))
    );
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await setFormRecipients({ formSlug, recipients });
      if (!res.ok) { setError(res.error); return; }
      setSavedAt(Date.now());
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-[10px] tracking-[0.16em] uppercase text-muted font-semibold inline-flex items-center gap-1.5">
            <Users className="h-3 w-3" /> Recipients
          </h3>
          <p className="text-[11px] text-muted mt-0.5">
            One founder email per company. Leave override empty to use the company's stored founder email.
          </p>
        </div>
        <Button variant="gold" size="sm" className="gap-1.5" onClick={save} disabled={pending}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Save recipients
        </Button>
      </div>

      {recipients.length === 0 ? (
        <div className="rounded-md border border-dashed border-line bg-paper2/30 p-4 text-center text-[12px] text-muted">
          No recipients yet. Add a company below to start sending this form to its founder.
        </div>
      ) : (
        <ul className="rounded-md border border-line divide-y divide-line bg-white">
          {recipients.map((r) => {
            const c = byId.get(r.companyId);
            if (!c) return null;
            const effective = r.founderEmailOverride || c.founderEmail || "";
            return (
              <li key={r.companyId} className="px-3 py-2 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink truncate">{c.name}</div>
                  <div className="text-[10px] text-muted truncate">
                    {c.founderEmail ? <>Default: {c.founderEmail}</> : <span className="text-coral">No founder email on file</span>}
                  </div>
                </div>
                <input
                  type="email"
                  value={r.founderEmailOverride ?? ""}
                  onChange={(e) => setOverride(r.companyId, e.target.value)}
                  placeholder={c.founderEmail ?? "founder@company.com"}
                  className="h-8 px-2 rounded-md border border-line text-[12px] w-56 focus:outline-none focus:ring-2 focus:ring-teal/30"
                />
                <button
                  type="button"
                  onClick={() => remove(r.companyId)}
                  className="text-muted hover:text-coral p-1"
                  aria-label="Remove recipient"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {available.length > 0 && (
        <details className="mt-3">
          <summary className="text-[12px] text-teal-600 cursor-pointer hover:underline">
            Add more companies ({available.length} available)
          </summary>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-1.5">
            {available.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => add(c.id)}
                className="text-left px-2.5 py-1.5 rounded-md border border-line text-[12px] text-ink hover:border-teal/40 hover:bg-teal-50/30 inline-flex items-center gap-1.5"
              >
                <Plus className="h-3 w-3 text-teal-600" /> {c.name}
              </button>
            ))}
          </div>
        </details>
      )}

      {error && (
        <div className="mt-2 rounded-md border border-coral/30 bg-coral/10 text-coral px-3 py-1.5 text-[11px] flex items-center gap-1.5">
          <AlertCircle className="h-3 w-3" /> {error}
        </div>
      )}
      {savedAt && Date.now() - savedAt < 3000 && (
        <div className="mt-2 text-[11px] text-teal-600 inline-flex items-center gap-1.5">
          <Check className="h-3 w-3" /> Recipients saved.
        </div>
      )}
    </div>
  );
}
