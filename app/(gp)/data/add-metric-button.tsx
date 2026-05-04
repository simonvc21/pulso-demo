"use client";

// L.9b — Add a custom metric inline from the data tab.
// Creates the metric_definitions row, applies it to every visible company,
// and refreshes the grid so the new row appears immediately.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createMetricDefinition } from "@/app/(gp)/companies/actions";
import { applyMetricToCompanies } from "@/app/(gp)/settings/metrics/actions";

type MetricType = "currency" | "number" | "percent" | "ratio" | "count";

interface Props {
  /** Companies the new metric will be applied to. */
  companyIds: string[];
}

export function AddMetricButton({ companyIds }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<MetricType>("number");
  const [unit, setUnit] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setLabel("");
    setType("number");
    setUnit("");
    setError(null);
  }

  function submit() {
    setError(null);
    if (!label.trim()) {
      setError("Label is required");
      return;
    }
    startTransition(async () => {
      const created = await createMetricDefinition({
        label: label.trim(),
        type,
        unit: unit.trim() || null,
      });
      if (!created.ok) { setError(created.error); return; }
      if (companyIds.length > 0) {
        const applied = await applyMetricToCompanies({
          metricDefinitionId: created.id,
          companyIds,
        });
        if (!applied.ok) { setError(applied.error); return; }
      }
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-3.5 w-3.5" /> Add metric
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 bg-navy/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-cardHover w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center justify-between px-5 py-3 border-b border-line">
              <h3 className="text-sm font-semibold text-ink">Add a custom metric</h3>
              <button onClick={() => setOpen(false)} className="text-muted hover:text-ink"><X className="h-4 w-4" /></button>
            </header>
            <div className="px-5 py-4 space-y-3">
              <p className="text-[11px] text-muted">
                Available immediately on every company in your fund. You'll see a new row in the data grid where you can enter values.
              </p>
              <label className="block">
                <span className="block text-[10px] font-semibold text-muted tracking-[0.14em] uppercase mb-1">Label</span>
                <input
                  autoFocus
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. NPS, GMV, MAU, Churn rate"
                  maxLength={60}
                  className="w-full h-10 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="block text-[10px] font-semibold text-muted tracking-[0.14em] uppercase mb-1">Type</span>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as MetricType)}
                    className="w-full h-10 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
                  >
                    <option value="currency">Currency (USD)</option>
                    <option value="number">Number</option>
                    <option value="percent">Percent</option>
                    <option value="ratio">Ratio</option>
                    <option value="count">Count</option>
                  </select>
                </label>
                <label className="block">
                  <span className="block text-[10px] font-semibold text-muted tracking-[0.14em] uppercase mb-1">Unit (optional)</span>
                  <input
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="USD, %, x, …"
                    maxLength={20}
                    className="w-full h-10 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
                  />
                </label>
              </div>
              {error && (
                <div className="rounded-md border border-coral/30 bg-coral/10 text-coral px-3 py-2 text-[12px]">{error}</div>
              )}
            </div>
            <footer className="px-5 py-3 border-t border-line bg-paper2/40 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
              <Button variant="gold" size="sm" className="gap-1.5" onClick={submit} disabled={pending || !label.trim()}>
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add metric
              </Button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
