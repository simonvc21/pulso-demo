"use client";

// L.9c — Add a period column inline. Pure client-state — cells get persisted
// to the DB when the GP types a value via the existing updateMetricCell flow.

import { useState } from "react";
import { Plus, X, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  /** Current periods so we can suggest the next one + reject duplicates. */
  existingPeriods: string[];
  /** Called when GP confirms a new period; parent appends to its quarters state. */
  onAdd: (period: string) => void;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function nextMonthlyPeriod(existing: string[]): string {
  // Try to find the latest "Mmm YYYY" period and increment by 1 month.
  for (let i = existing.length - 1; i >= 0; i--) {
    const m = /^([A-Za-z]{3,9})\s+(\d{4})$/.exec(existing[i].trim());
    if (m) {
      const monthIdx = MONTHS.findIndex((mm) => mm.toLowerCase() === m[1].slice(0, 3).toLowerCase());
      if (monthIdx >= 0) {
        const year = parseInt(m[2], 10);
        const next = monthIdx === 11 ? `${MONTHS[0]} ${year + 1}` : `${MONTHS[monthIdx + 1]} ${year}`;
        if (!existing.includes(next)) return next;
      }
    }
  }
  // Fallback to current month.
  const now = new Date();
  return `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
}

function nextQuarterlyPeriod(existing: string[]): string {
  for (let i = existing.length - 1; i >= 0; i--) {
    const m = /^Q([1-4])\s+(\d{4})$/.exec(existing[i].trim());
    if (m) {
      const q = parseInt(m[1], 10);
      const year = parseInt(m[2], 10);
      const next = q === 4 ? `Q1 ${year + 1}` : `Q${q + 1} ${year}`;
      if (!existing.includes(next)) return next;
    }
  }
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1;
  return `Q${q} ${now.getFullYear()}`;
}

export function AddPeriodButton({ existingPeriods, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [cadence, setCadence] = useState<"monthly" | "quarterly">("monthly");
  const [label, setLabel] = useState(() => nextMonthlyPeriod(existingPeriods));
  const [error, setError] = useState<string | null>(null);

  function pickCadence(c: "monthly" | "quarterly") {
    setCadence(c);
    setLabel(c === "monthly" ? nextMonthlyPeriod(existingPeriods) : nextQuarterlyPeriod(existingPeriods));
    setError(null);
  }

  function submit() {
    const trimmed = label.trim();
    if (!trimmed) {
      setError("Period label is required");
      return;
    }
    if (existingPeriods.some((p) => p.trim().toLowerCase() === trimmed.toLowerCase())) {
      setError("That period already exists");
      return;
    }
    if (cadence === "monthly" && !/^[A-Za-z]{3,9}\s+\d{4}$/.test(trimmed)) {
      setError("Use 'Mar 2026' format for monthly periods");
      return;
    }
    if (cadence === "quarterly" && !/^Q[1-4]\s+\d{4}$/.test(trimmed)) {
      setError("Use 'Q1 2026' format for quarterly periods");
      return;
    }
    onAdd(trimmed);
    setOpen(false);
    setError(null);
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Calendar className="h-3.5 w-3.5" /> Add period
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 bg-navy/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-cardHover w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center justify-between px-5 py-3 border-b border-line">
              <h3 className="text-sm font-semibold text-ink">Add a period</h3>
              <button onClick={() => setOpen(false)} className="text-muted hover:text-ink"><X className="h-4 w-4" /></button>
            </header>
            <div className="px-5 py-4 space-y-3">
              <p className="text-[11px] text-muted">
                Adds an empty column to every company. Type values into the cells to fill them in — Pulso saves on blur.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => pickCadence("monthly")}
                  className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-colors ${cadence === "monthly" ? "border-navy bg-navy/5 text-navy" : "border-line text-muted hover:text-ink"}`}
                >
                  Monthly
                  <div className="text-[10px] font-normal mt-0.5">Mar 2026</div>
                </button>
                <button
                  type="button"
                  onClick={() => pickCadence("quarterly")}
                  className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-colors ${cadence === "quarterly" ? "border-navy bg-navy/5 text-navy" : "border-line text-muted hover:text-ink"}`}
                >
                  Quarterly
                  <div className="text-[10px] font-normal mt-0.5">Q1 2026</div>
                </button>
              </div>
              <label className="block">
                <span className="block text-[10px] font-semibold text-muted tracking-[0.14em] uppercase mb-1">Period label</span>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  maxLength={20}
                  className="w-full h-10 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
                  onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                />
              </label>
              {error && (
                <div className="rounded-md border border-coral/30 bg-coral/10 text-coral px-3 py-2 text-[12px]">{error}</div>
              )}
            </div>
            <footer className="px-5 py-3 border-t border-line bg-paper2/40 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="gold" size="sm" className="gap-1.5" onClick={submit} disabled={!label.trim()}>
                <Plus className="h-3.5 w-3.5" /> Add column
              </Button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
