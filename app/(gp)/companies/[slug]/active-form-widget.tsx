"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Send, AlertCircle, CheckCircle2, Clock, Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { sendExtraForm, clearActiveForm } from "./active-form-actions";
// L.11 — types-only import (client-safe). formatDueIn re-declared inline so
// we don't pull lib/active-form.ts (which uses next/headers) into the client.
import type { ActiveFormSummary, ActiveFormStatus } from "@/lib/active-form";

function formatDueIn(iso: string | null): string {
  if (!iso) return "no due date";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) {
    const days = Math.floor(-ms / (24 * 60 * 60 * 1000));
    return days === 0 ? "due today" : `${days}d overdue`;
  }
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days === 0) return "due today";
  if (days < 7) return `due in ${days}d`;
  return `due ${new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

interface FormOption { slug: string; name: string; }

interface Props {
  companyId: string;
  companySlug: string;
  initial: ActiveFormSummary | null;
  /** Forms in the same org so the GP can pick one for "Send extra". */
  formOptions: FormOption[];
}

const STATUS_META: Record<ActiveFormStatus, { label: string; tone: string; icon: any }> = {
  pending:   { label: "Pending",   tone: "bg-gold-50 text-gold-600 border-gold/30",     icon: Clock },
  submitted: { label: "Submitted", tone: "bg-teal-50 text-teal-600 border-teal/30",     icon: CheckCircle2 },
  overdue:   { label: "Overdue",   tone: "bg-coral/10 text-coral border-coral/30",     icon: AlertCircle },
};

export function ActiveFormWidget({ companyId, companySlug, initial, formOptions }: Props) {
  const [active, setActive] = useState<ActiveFormSummary | null>(initial);
  const [showDialog, setShowDialog] = useState(false);
  const [pending, startTransition] = useTransition();

  // Derive effective status (overdue if past due_at).
  const status = (() => {
    if (!active) return null;
    if (active.status === "submitted") return "submitted" as ActiveFormStatus;
    if (active.dueAt && new Date(active.dueAt).getTime() < Date.now()) return "overdue" as ActiveFormStatus;
    return active.status;
  })();

  const founderLink = `/fill/current?company=${companySlug}`;

  return (
    <div className="bg-white rounded-xl border border-line shadow-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-[10px] font-semibold text-muted tracking-[0.16em] uppercase">
            Active form
          </div>
          {active && status ? (
            <>
              <span className={cn(
                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium",
                STATUS_META[status].tone,
              )}>
                {(() => { const Icon = STATUS_META[status].icon; return <Icon className="h-3 w-3" />; })()}
                {STATUS_META[status].label}
              </span>
              <Link
                href={`/forms/${active.formSlug}`}
                className="text-sm font-semibold text-ink hover:text-teal-600 truncate"
              >
                {active.formName}
              </Link>
              {active.periodLabel && (
                <span className="text-[11px] text-muted">· {active.periodLabel}</span>
              )}
              {active.dueAt && (
                <span className={cn(
                  "text-[11px]",
                  status === "overdue" ? "text-coral font-medium" : "text-muted",
                )}>
                  · {formatDueIn(active.dueAt)}
                </span>
              )}
              {active.isExtra && (
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-paper2 text-muted font-semibold">
                  Extra
                </span>
              )}
            </>
          ) : (
            <span className="text-[12px] text-muted italic">No active form. Founder is caught up.</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {active && (
            <a href={founderLink} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Send className="h-3.5 w-3.5" /> Founder link
              </Button>
            </a>
          )}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowDialog(true)}>
            <Plus className="h-3.5 w-3.5" /> Send extra
          </Button>
        </div>
      </div>

      {showDialog && (
        <SendExtraDialog
          companyId={companyId}
          formOptions={formOptions}
          pending={pending}
          onClose={() => setShowDialog(false)}
          onSubmit={(formSlug, dueInDays, periodLabel) => {
            startTransition(async () => {
              const res = await sendExtraForm({
                companyId,
                formSlug,
                dueInDays,
                periodLabel,
              });
              if (res.ok) {
                const opt = formOptions.find((o) => o.slug === formSlug);
                setActive({
                  id: "tmp",
                  companyId,
                  formId: "tmp",
                  formSlug,
                  formName: opt?.name ?? formSlug,
                  dueAt: dueInDays ? new Date(Date.now() + dueInDays * 86400000).toISOString() : null,
                  periodLabel: periodLabel ?? null,
                  status: "pending",
                  isExtra: true,
                });
                setShowDialog(false);
              } else {
                alert(res.error);
              }
            });
          }}
          onClear={() => {
            if (!confirm("Clear the active form? Founder will see 'all caught up' next time.")) return;
            startTransition(async () => {
              const res = await clearActiveForm({ companyId });
              if (res.ok) {
                setActive(null);
                setShowDialog(false);
              } else {
                alert(res.error);
              }
            });
          }}
          hasActive={!!active}
        />
      )}
    </div>
  );
}

function SendExtraDialog({
  companyId, formOptions, pending, onClose, onSubmit, onClear, hasActive,
}: {
  companyId: string;
  formOptions: FormOption[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (formSlug: string, dueInDays: number | undefined, periodLabel: string | undefined) => void;
  onClear: () => void;
  hasActive: boolean;
}) {
  const [formSlug, setFormSlug] = useState(formOptions[0]?.slug ?? "");
  const [dueInDays, setDueInDays] = useState<string>("14");
  const [periodLabel, setPeriodLabel] = useState<string>(
    new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" })
  );

  return (
    <div className="fixed inset-0 z-50 bg-navy/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-cardHover w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between px-5 py-3 border-b border-line">
          <h3 className="text-sm font-semibold text-ink">Send an extra form</h3>
          <button onClick={onClose} className="text-muted hover:text-ink"><X className="h-4 w-4" /></button>
        </header>
        <div className="px-5 py-4 space-y-3">
          <p className="text-[12px] text-muted">
            Overrides the schedule. The founder will see this form at <code className="bg-paper2 px-1 rounded">/fill/current</code> until they submit it.
          </p>

          <label className="block">
            <span className="block text-[10px] font-semibold text-muted tracking-[0.14em] uppercase mb-1">Form</span>
            <select
              value={formSlug}
              onChange={(e) => setFormSlug(e.target.value)}
              className="w-full h-9 px-2.5 rounded-md border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
            >
              {formOptions.map((o) => <option key={o.slug} value={o.slug}>{o.name}</option>)}
              {formOptions.length === 0 && <option value="">No forms yet — create one first</option>}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[10px] font-semibold text-muted tracking-[0.14em] uppercase mb-1">Due in (days)</span>
              <input
                type="number"
                min={1}
                max={90}
                value={dueInDays}
                onChange={(e) => setDueInDays(e.target.value)}
                className="w-full h-9 px-2.5 rounded-md border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 tabular-nums"
              />
            </label>
            <label className="block">
              <span className="block text-[10px] font-semibold text-muted tracking-[0.14em] uppercase mb-1">Period label</span>
              <input
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
                placeholder="Mar 2026"
                maxLength={20}
                className="w-full h-9 px-2.5 rounded-md border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
              />
            </label>
          </div>
        </div>
        <footer className="px-5 py-3 border-t border-line bg-paper2/40 flex items-center justify-between">
          {hasActive ? (
            <button
              type="button"
              onClick={onClear}
              disabled={pending}
              className="text-[11px] text-coral hover:underline"
            >
              Clear active form
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>Cancel</Button>
            <Button
              variant="gold"
              size="sm"
              className="gap-1.5"
              onClick={() => onSubmit(formSlug, parseInt(dueInDays, 10) || undefined, periodLabel.trim() || undefined)}
              disabled={pending || !formSlug}
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Assign
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
