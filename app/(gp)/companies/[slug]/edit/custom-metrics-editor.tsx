"use client";

import { useState, useTransition, useMemo } from "react";
import { Plus, Trash2, Loader2, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  createMetricDefinition,
  deleteMetricDefinition,
  upsertCustomMetricValue,
} from "../../actions";
import type {
  CustomMetricSeries,
  CustomMetricDefinition,
  CustomMetricType,
} from "@/lib/dashboard-data";

interface Props {
  companyId: string;
  initialSeries: CustomMetricSeries[];
  // Quarters that exist on the company's main `metrics` table — we surface
  // those plus the current/next quarter as the inline grid columns.
  contextQuarters: string[];
}

const TYPE_OPTIONS: { value: CustomMetricType; label: string }[] = [
  { value: "currency", label: "Currency" },
  { value: "number", label: "Number" },
  { value: "percent", label: "Percent" },
  { value: "ratio", label: "Ratio" },
  { value: "count", label: "Count" },
];

function quarterKey(q: string): number {
  const m = /^Q(\d)\s+(\d{4})$/.exec(q.trim());
  if (!m) return 0;
  return parseInt(m[2], 10) * 10 + parseInt(m[1], 10);
}

function currentQuarter(): string {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()}`;
}

function formatValue(v: number | null, type: CustomMetricType): string {
  if (v == null) return "";
  if (type === "currency") return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (type === "percent") return `${v}`;
  return v.toLocaleString("en-US");
}

export function CustomMetricsEditor({ companyId, initialSeries, contextQuarters }: Props) {
  const [series, setSeries] = useState<CustomMetricSeries[]>(initialSeries);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(initialSeries.length === 0);

  // New definition draft state
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<CustomMetricType>("number");
  const [newUnit, setNewUnit] = useState("");

  // Cell saving indicators keyed by `${defId}|${quarter}`
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [savedCell, setSavedCell] = useState<string | null>(null);

  // Quarter grid: union of (existing main quarters) + (any quarter the
  // company already has custom values for) + current quarter.
  const quarters = useMemo(() => {
    const set = new Set<string>(contextQuarters);
    for (const s of series) for (const v of s.values) set.add(v.quarter);
    set.add(currentQuarter());
    return Array.from(set).sort((a, b) => quarterKey(a) - quarterKey(b));
  }, [series, contextQuarters]);

  function valueOf(s: CustomMetricSeries, q: string): number | null {
    return s.values.find((v) => v.quarter === q)?.value ?? null;
  }

  function addDefinition() {
    setError(null);
    if (!newLabel.trim()) { setError("Label is required"); return; }
    startTransition(async () => {
      const res = await createMetricDefinition({
        label: newLabel,
        type: newType,
        unit: newUnit || null,
      });
      if (!res.ok) { setError(res.error); return; }
      // Optimistically add an empty series for it
      const def: CustomMetricDefinition = {
        id: res.id,
        label: newLabel.trim(),
        type: newType,
        unit: newUnit.trim() || null,
      };
      setSeries((prev) => {
        if (prev.some((s) => s.definition.id === def.id)) return prev;
        return [...prev, { definition: def, values: [], latest: null, prev: null }]
          .sort((a, b) => a.definition.label.localeCompare(b.definition.label));
      });
      setNewLabel("");
      setNewUnit("");
      setNewType("number");
      setShowAdd(false);
    });
  }

  function removeDefinition(definitionId: string) {
    if (!confirm("Delete this metric and all its values across this company? This affects only this fund.")) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteMetricDefinition(definitionId);
      if (!res.ok) { setError(res.error); return; }
      setSeries((prev) => prev.filter((s) => s.definition.id !== definitionId));
    });
  }

  function saveCell(definitionId: string, quarter: string, raw: string) {
    setError(null);
    const trimmed = raw.trim();
    const value = trimmed === "" ? null : Number(trimmed.replace(/,/g, ""));
    if (trimmed !== "" && !Number.isFinite(value)) {
      setError(`"${raw}" is not a number`);
      return;
    }
    const cellKey = `${definitionId}|${quarter}`;
    setSavingCell(cellKey);

    // Optimistic state
    setSeries((prev) => prev.map((s) => {
      if (s.definition.id !== definitionId) return s;
      const others = s.values.filter((v) => v.quarter !== quarter);
      const next = value == null ? others : [...others, { quarter, value }];
      next.sort((a, b) => quarterKey(a.quarter) - quarterKey(b.quarter));
      return {
        ...s,
        values: next,
        latest: next[next.length - 1]?.value ?? null,
        prev: next[next.length - 2]?.value ?? null,
      };
    }));

    startTransition(async () => {
      const res = await upsertCustomMetricValue({
        companyId,
        metricDefinitionId: definitionId,
        quarter,
        value: value as number | null,
      });
      setSavingCell(null);
      if (!res.ok) { setError(res.error); return; }
      setSavedCell(cellKey);
      setTimeout(() => setSavedCell((cur) => (cur === cellKey ? null : cur)), 1200);
    });
  }

  return (
    <div className="bg-white rounded-xl border border-line shadow-card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-[10px] tracking-[0.16em] uppercase text-muted font-semibold">Custom metrics</h3>
          <p className="text-[11px] text-muted mt-0.5">
            Per-company metrics on top of the universal 5 (ARR / Burn / Cash / Revenue / Headcount). NPS, GMV, churn, anything you want to track.
          </p>
        </div>
        {!showAdd && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowAdd(true)}>
            <Plus className="h-3.5 w-3.5" /> Add metric
          </Button>
        )}
      </div>

      {showAdd && (
        <div className="bg-paper rounded-lg border border-dashed border-line p-3 mb-4 space-y-3">
          {/* Three fields share a row; buttons get their own row so they
              never overlap the inputs even on small viewports. */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <div className="md:col-span-5">
              <label className="block text-[9px] font-semibold text-muted tracking-[0.14em] uppercase mb-1">Label</label>
              <input
                autoFocus
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDefinition(); } }}
                placeholder="NPS"
                maxLength={60}
                className="w-full h-9 px-2.5 rounded-md border border-line text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal/30"
              />
            </div>
            <div className="md:col-span-4">
              <label className="block text-[9px] font-semibold text-muted tracking-[0.14em] uppercase mb-1">Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as CustomMetricType)}
                className="w-full h-9 px-2.5 rounded-md border border-line text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal/30"
              >
                {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block text-[9px] font-semibold text-muted tracking-[0.14em] uppercase mb-1">Unit</label>
              <input
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                placeholder="USD, %, users"
                maxLength={20}
                className="w-full h-9 px-2.5 rounded-md border border-line text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal/30"
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="gold"
              size="sm"
              className="gap-1.5"
              onClick={addDefinition}
              disabled={pending || !newLabel.trim()}
              title={!newLabel.trim() ? "Type a label first" : undefined}
            >
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Add
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-coral/30 bg-coral/10 text-coral px-3 py-1.5 text-[11px] mb-3 flex items-center gap-1.5">
          <AlertCircle className="h-3 w-3" /> {error}
        </div>
      )}

      {series.length === 0 ? (
        <div className="text-[12px] text-muted italic px-2 py-4">
          No custom metrics yet. Click "Add metric" above to define your first one.
        </div>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-[12px] tabular-nums">
            <thead>
              <tr className="text-[10px] tracking-[0.14em] uppercase text-muted">
                <th className="text-left font-semibold px-2 py-2 sticky left-0 bg-white min-w-[160px]">Metric</th>
                {quarters.map((q) => (
                  <th key={q} className="text-right font-semibold px-2 py-2">{q}</th>
                ))}
                <th className="px-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {series.map((s) => (
                <tr key={s.definition.id} className="hover:bg-paper">
                  <td className="px-2 py-2 sticky left-0 bg-white">
                    <div className="text-sm font-semibold text-ink">{s.definition.label}</div>
                    <div className="text-[10px] text-muted uppercase tracking-[0.12em]">
                      {s.definition.type}{s.definition.unit ? ` · ${s.definition.unit}` : ""}
                    </div>
                  </td>
                  {quarters.map((q) => {
                    const cellKey = `${s.definition.id}|${q}`;
                    const v = valueOf(s, q);
                    return (
                      <CellEditor
                        key={cellKey}
                        initial={v}
                        type={s.definition.type}
                        saving={savingCell === cellKey}
                        saved={savedCell === cellKey}
                        onCommit={(raw) => saveCell(s.definition.id, q, raw)}
                      />
                    );
                  })}
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeDefinition(s.definition.id)}
                      className="text-muted hover:text-coral"
                      aria-label={`Delete ${s.definition.label}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CellEditor({
  initial, type, saving, saved, onCommit,
}: {
  initial: number | null;
  type: CustomMetricType;
  saving: boolean;
  saved: boolean;
  onCommit: (raw: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial == null ? "" : String(initial));
  const display = formatValue(initial, type);

  if (!editing) {
    return (
      <td
        onClick={() => { setDraft(initial == null ? "" : String(initial)); setEditing(true); }}
        className={cn(
          "px-2 py-2 text-right cursor-text",
          initial == null && "text-muted/60",
          saved && "bg-teal-50 transition-colors",
          saving && "bg-gold-50 transition-colors",
        )}
      >
        <span className="inline-flex items-center gap-1.5 justify-end">
          {display || "—"}
          {saving && <Loader2 className="h-3 w-3 animate-spin text-muted" />}
          {saved && !saving && <Check className="h-3 w-3 text-teal-600" />}
        </span>
      </td>
    );
  }

  return (
    <td className="px-1 py-1">
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft !== (initial == null ? "" : String(initial))) onCommit(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(initial == null ? "" : String(initial));
            setEditing(false);
          }
        }}
        className="w-full h-7 px-2 rounded border border-teal text-[12px] focus:outline-none focus:ring-2 focus:ring-teal/30 tabular-nums bg-white text-right"
      />
    </td>
  );
}
