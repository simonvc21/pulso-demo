"use client";

import { useState, useTransition } from "react";
import { Calendar, Loader2, Check, AlertCircle, Pause, Play, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  upsertFormSchedule,
  pauseFormSchedule,
  resumeFormSchedule,
} from "../../actions";
import {
  computeNextSendAt,
  type ScheduleCadence,
  type FormSchedule,
} from "@/lib/form-schedule";

interface Props {
  formSlug: string;
  initial: FormSchedule | null;
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

export function ScheduleEditor({ formSlug, initial }: Props) {
  const [cadence, setCadence] = useState<ScheduleCadence>(initial?.cadence ?? "quarterly");
  const [sendDayOfMonth, setSendDayOfMonth] = useState<number>(initial?.sendDayOfMonth ?? 15);
  const [anchorMonth, setAnchorMonth] = useState<number>(initial?.anchorMonth ?? 1);
  const [reminderOffsets, setReminderOffsets] = useState<number[]>(
    initial?.reminderOffsetsDays ?? [7, 2]
  );
  const [active, setActive] = useState<boolean>(initial?.active ?? true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Live preview of next send
  const previewNext = computeNextSendAt(cadence, sendDayOfMonth, anchorMonth);

  const showDay = cadence !== "ad_hoc";
  const showMonth = cadence === "quarterly" || cadence === "annual";

  function toggleOffset(d: number) {
    setReminderOffsets((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => b - a)
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
        reminderOffsetsDays: reminderOffsets,
        active,
      });
      if (!res.ok) { setError(res.error); return; }
      setSavedAt(Date.now());
    });
  }

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

      {/* Reminder offsets */}
      {cadence !== "ad_hoc" && (
        <div className="mb-4">
          <span className="block text-[10px] font-semibold text-ink tracking-[0.14em] uppercase mb-1.5">
            Reminders
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {COMMON_OFFSETS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleOffset(d)}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors",
                  reminderOffsets.includes(d)
                    ? "bg-gold/10 border-gold/40 text-gold-600"
                    : "bg-white border-line text-muted hover:border-navy/40 hover:text-ink"
                )}
              >
                {reminderOffsets.includes(d) ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                {d} day{d === 1 ? "" : "s"} before
              </button>
            ))}
          </div>
          {reminderOffsets.length > 0 && (
            <p className="text-[10px] text-muted mt-1.5">
              Reminders fire {reminderOffsets.join(", ")} day{reminderOffsets.length > 1 || reminderOffsets[0] !== 1 ? "s" : ""} before each send.
            </p>
          )}
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
    </div>
  );
}
