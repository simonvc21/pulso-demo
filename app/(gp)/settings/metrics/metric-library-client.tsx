"use client";

// L.4b — Metric library client. Two views:
//   - List of metrics with type + unit + applied count + value count
//   - "Apply" matrix per metric: pick which companies it tracks
//   - Inline "create metric" + "import CSV"

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Search, X, Check, Trash2, Upload, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  applyMetricToCompanies,
  removeMetricFromCompany,
  bulkUpsertCustomValues,
  type BulkCustomRow,
} from "./actions";
import { createMetricDefinition, deleteMetricDefinition } from "../../companies/actions";
import type { LibraryMetric, LibraryCompany } from "@/lib/metric-library";
import type { CustomMetricType } from "@/lib/dashboard-data";

const TYPE_OPTIONS: { value: CustomMetricType; label: string; defaultUnit: string }[] = [
  { value: "currency", label: "Currency (USD)", defaultUnit: "USD" },
  { value: "number",   label: "Number",         defaultUnit: "" },
  { value: "percent",  label: "Percent",        defaultUnit: "%" },
  { value: "ratio",    label: "Ratio",          defaultUnit: "x" },
  { value: "count",    label: "Count",          defaultUnit: "" },
];

interface Props {
  metrics: LibraryMetric[];
  companies: LibraryCompany[];
}

export function MetricLibraryClient({ metrics: initialMetrics, companies }: Props) {
  const [metrics, setMetrics] = useState(initialMetrics);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [openMetricId, setOpenMetricId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return metrics;
    return metrics.filter((m) => m.label.toLowerCase().includes(s));
  }, [metrics, search]);

  return (
    <>
      <div className="bg-white rounded-xl border border-line shadow-card overflow-hidden">
        <header className="px-5 py-4 border-b border-line flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-ink">Metrics in your fund</h2>
            <p className="text-[11px] text-muted mt-0.5">
              Define a metric once, then apply it to as many companies as you want. Values can come
              from forms, manual entry, or CSV import.
            </p>
          </div>
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search metrics"
              className="h-8 pl-8 pr-2.5 rounded-md border border-line text-sm w-56 focus:outline-none focus:ring-2 focus:ring-teal/30"
            />
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowImport(true)}>
            <Upload className="h-3.5 w-3.5" /> Import CSV
          </Button>
          <Button variant="gold" size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5" /> New metric
          </Button>
        </header>

        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted">
            {metrics.length === 0
              ? "No metrics yet. Create your first one — NPS, GMV, MAU, anything you want to track across companies."
              : `No metrics match "${search}"`}
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((m) => (
              <MetricRow
                key={m.id}
                metric={m}
                companies={companies}
                expanded={openMetricId === m.id}
                onToggle={() => setOpenMetricId(openMetricId === m.id ? null : m.id)}
                onUpdate={(next) =>
                  setMetrics((prev) => prev.map((x) => (x.id === next.id ? next : x)))
                }
                onDelete={() => setMetrics((prev) => prev.filter((x) => x.id !== m.id))}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="text-[11px] text-muted">
        Tip: applying a metric creates an empty chart on each company's page. Add values via the
        company edit page, the data grid, an active form, or CSV import.
      </div>

      {showCreate && (
        <CreateMetricDialog
          onClose={() => setShowCreate(false)}
          onCreated={(m) => {
            setMetrics((prev) => [...prev, m].sort((a, b) => a.label.localeCompare(b.label)));
            setShowCreate(false);
            setOpenMetricId(m.id);
          }}
        />
      )}

      {showImport && (
        <ImportCsvDialog
          companies={companies}
          metrics={metrics}
          onClose={() => setShowImport(false)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Single row + apply matrix
// ---------------------------------------------------------------------------

function MetricRow({
  metric, companies, expanded, onToggle, onUpdate, onDelete,
}: {
  metric: LibraryMetric;
  companies: LibraryCompany[];
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (next: LibraryMetric) => void;
  onDelete: () => void;
}) {
  const [pending, startTransition] = useTransition();

  const appliedSet = useMemo(() => new Set(metric.appliedCompanyIds), [metric.appliedCompanyIds]);
  const [draft, setDraft] = useState<Set<string>>(appliedSet);

  // When the row is opened/closed reset the draft to the saved state.
  function syncDraft() { setDraft(new Set(metric.appliedCompanyIds)); }

  const dirty = useMemo(() => {
    if (draft.size !== appliedSet.size) return true;
    for (const id of draft) if (!appliedSet.has(id)) return true;
    return false;
  }, [draft, appliedSet]);

  function toggle(id: string) {
    const next = new Set(draft);
    if (next.has(id)) next.delete(id); else next.add(id);
    setDraft(next);
  }

  function selectAll() { setDraft(new Set(companies.map((c) => c.id))); }
  function selectNone() { setDraft(new Set()); }

  function save() {
    const toAdd = Array.from(draft).filter((id) => !appliedSet.has(id));
    const toRemove = Array.from(appliedSet).filter((id) => !draft.has(id));

    startTransition(async () => {
      if (toAdd.length > 0) {
        const res = await applyMetricToCompanies({
          metricDefinitionId: metric.id,
          companyIds: toAdd,
        });
        if (!res.ok) { alert(res.error); return; }
      }
      for (const cid of toRemove) {
        const res = await removeMetricFromCompany({
          metricDefinitionId: metric.id,
          companyId: cid,
          // Don't auto-clear values — those are user data. Removing a metric
          // just hides the empty chart; existing values remain.
          clearValues: false,
        });
        if (!res.ok) { alert(res.error); return; }
      }
      onUpdate({ ...metric, appliedCompanyIds: Array.from(draft) });
    });
  }

  function remove() {
    if (!confirm(`Delete "${metric.label}"? This removes the metric from every company and deletes all its values. This cannot be undone.`)) return;
    startTransition(async () => {
      const res = await deleteMetricDefinition(metric.id);
      if (!res.ok) { alert(res.error); return; }
      onDelete();
    });
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => { if (!expanded) syncDraft(); onToggle(); }}
        className="w-full px-5 py-3 flex items-center gap-3 hover:bg-paper2/40 text-left"
      >
        {expanded
          ? <ChevronDown className="h-4 w-4 text-muted shrink-0" />
          : <ChevronRight className="h-4 w-4 text-muted shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-ink truncate">{metric.label}</div>
          <div className="text-[11px] text-muted mt-0.5 flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded bg-paper2 font-medium uppercase tracking-wider text-[9px]">
              {metric.type}
            </span>
            {metric.unit && <span>· {metric.unit}</span>}
            <span>· applied to {metric.appliedCompanyIds.length}/{companies.length} companies</span>
            <span>· {metric.filledValueCount} value{metric.filledValueCount === 1 ? "" : "s"}</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-4 space-y-3 bg-paper2/30 border-t border-line">
          <div className="pt-3 flex items-center gap-3">
            <div className="text-[10px] font-semibold text-muted tracking-[0.14em] uppercase">
              Applied to companies
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={selectAll}
                className="text-[11px] text-teal-600 hover:underline"
              >Select all</button>
              <span className="text-[11px] text-muted">·</span>
              <button
                type="button"
                onClick={selectNone}
                className="text-[11px] text-muted hover:text-ink"
              >Clear</button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
            {companies.map((c) => {
              const on = draft.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggle(c.id)}
                  className={cn(
                    "flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-sm text-left",
                    on
                      ? "bg-teal-50 border-teal/40 text-ink"
                      : "bg-white border-line text-muted hover:border-line/60",
                  )}
                >
                  <span className={cn(
                    "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                    on ? "bg-teal-600 border-teal-600 text-white" : "border-line bg-white",
                  )}>
                    {on && <Check className="h-3 w-3" />}
                  </span>
                  <span className="truncate">{c.name}</span>
                </button>
              );
            })}
            {companies.length === 0 && (
              <div className="col-span-full text-[12px] text-muted italic">
                No companies in your fund yet. <Link href="/companies/new" className="underline">Add one</Link> first.
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-line">
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="text-[11px] text-coral hover:underline flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" /> Delete metric
            </button>
            <div className="flex items-center gap-2">
              {dirty && (
                <button
                  type="button"
                  onClick={syncDraft}
                  disabled={pending}
                  className="text-[11px] text-muted hover:text-ink"
                >
                  Discard
                </button>
              )}
              <Button
                variant={dirty ? "gold" : "outline"}
                size="sm"
                onClick={save}
                disabled={!dirty || pending}
                className="gap-1.5"
              >
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                {dirty ? "Save changes" : "Saved"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Create metric dialog
// ---------------------------------------------------------------------------

function CreateMetricDialog({
  onClose, onCreated,
}: {
  onClose: () => void;
  onCreated: (metric: LibraryMetric) => void;
}) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<CustomMetricType>("number");
  const [unit, setUnit] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!label.trim()) { alert("Label is required"); return; }
    startTransition(async () => {
      const res = await createMetricDefinition({ label: label.trim(), type, unit: unit.trim() || null });
      if (!res.ok) { alert(res.error); return; }
      onCreated({
        id: res.id,
        label: label.trim(),
        type,
        unit: unit.trim() || null,
        appliedCompanyIds: [],
        filledValueCount: 0,
      });
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-navy/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-cardHover w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between px-5 py-3 border-b border-line">
          <h3 className="text-sm font-semibold text-ink">New metric</h3>
          <button onClick={onClose} className="text-muted hover:text-ink"><X className="h-4 w-4" /></button>
        </header>
        <div className="px-5 py-4 space-y-3">
          <label className="block">
            <span className="block text-[10px] font-semibold text-muted tracking-[0.14em] uppercase mb-1">Label</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. NPS, GMV, MAU"
              maxLength={60}
              autoFocus
              className="w-full h-9 px-2.5 rounded-md border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[10px] font-semibold text-muted tracking-[0.14em] uppercase mb-1">Type</span>
              <select
                value={type}
                onChange={(e) => {
                  const next = e.target.value as CustomMetricType;
                  setType(next);
                  const opt = TYPE_OPTIONS.find((o) => o.value === next);
                  if (opt) setUnit(opt.defaultUnit);
                }}
                className="w-full h-9 px-2.5 rounded-md border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
              >
                {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-[10px] font-semibold text-muted tracking-[0.14em] uppercase mb-1">Unit (optional)</span>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="USD, %, x, ..."
                maxLength={20}
                className="w-full h-9 px-2.5 rounded-md border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
              />
            </label>
          </div>
        </div>
        <footer className="px-5 py-3 border-t border-line bg-paper2/40 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button variant="gold" size="sm" onClick={submit} disabled={pending || !label.trim()}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Create
          </Button>
        </footer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSV import dialog
// ---------------------------------------------------------------------------

function ImportCsvDialog({
  companies, metrics, onClose,
}: {
  companies: LibraryCompany[];
  metrics: LibraryMetric[];
  onClose: () => void;
}) {
  const [csv, setCsv] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    inserted: number; updated: number; skipped: number; errors: string[];
  } | null>(null);

  function submit() {
    const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) { alert("Paste some CSV first"); return; }
    // Skip header if present.
    const startIdx = /company/i.test(lines[0]) && /metric/i.test(lines[0]) ? 1 : 0;

    const rows: BulkCustomRow[] = [];
    for (let i = startIdx; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length < 4) continue;
      const [companyKey, metricLabel, period, valueStr] = cols;
      const v = valueStr.trim();
      const value = v === "" ? null : Number(v.replace(/[$,]/g, ""));
      rows.push({
        companyKey,
        metricLabel,
        period,
        value: Number.isFinite(value as number) ? (value as number) : null,
        lineNumber: i + 1,
      });
    }
    if (rows.length === 0) { alert("No data rows found"); return; }

    startTransition(async () => {
      const res = await bulkUpsertCustomValues(rows);
      if (!res.ok) { alert(res.error); return; }
      setResult({
        inserted: res.inserted, updated: res.updated, skipped: res.skipped, errors: res.errors,
      });
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-navy/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-cardHover w-full max-w-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between px-5 py-3 border-b border-line">
          <h3 className="text-sm font-semibold text-ink">Import custom metric values</h3>
          <button onClick={onClose} className="text-muted hover:text-ink"><X className="h-4 w-4" /></button>
        </header>
        <div className="px-5 py-4 space-y-3">
          <div className="text-[12px] text-muted leading-relaxed">
            Paste CSV with columns:
            <code className="block mt-1 px-2 py-1 bg-paper2 rounded text-[11px] font-mono">
              company,metric,period,value
            </code>
            <ul className="mt-2 space-y-0.5 text-[11px]">
              <li>· <strong>company</strong>: slug or name (case-insensitive)</li>
              <li>· <strong>metric</strong>: must already exist in this library — create it first if needed</li>
              <li>· <strong>period</strong>: <code>Mar 2026</code>, <code>M03 2026</code>, <code>Q1 2026</code>, or <code>FY 2026</code></li>
              <li>· <strong>value</strong>: number, blank to clear</li>
            </ul>
            <div className="mt-2 text-[11px]">
              Available metrics ({metrics.length}): {metrics.slice(0, 10).map((m) => m.label).join(", ")}
              {metrics.length > 10 && "..."}
            </div>
            <div className="mt-1 text-[11px]">
              Companies ({companies.length}): {companies.slice(0, 10).map((c) => c.slug).join(", ")}
              {companies.length > 10 && "..."}
            </div>
          </div>

          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder={`company,metric,period,value\nvextra,NPS,Mar 2026,42\nvextra,NPS,Apr 2026,48\nzendro,GMV,Mar 2026,125000`}
            rows={10}
            className="w-full px-3 py-2 rounded-md border border-line text-[12px] font-mono focus:outline-none focus:ring-2 focus:ring-teal/30 resize-none"
          />

          {result && (
            <div className="rounded-lg border border-line bg-paper2/40 px-3 py-2 text-[12px]">
              <div className="font-semibold text-ink">
                {result.inserted} inserted · {result.updated} updated · {result.skipped} skipped
              </div>
              {result.errors.length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-coral">
                    {result.errors.length} error{result.errors.length === 1 ? "" : "s"}
                  </summary>
                  <ul className="mt-1 space-y-0.5 text-[11px] text-coral max-h-40 overflow-auto">
                    {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
        <footer className="px-5 py-3 border-t border-line bg-paper2/40 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>
            {result ? "Done" : "Cancel"}
          </Button>
          {!result && (
            <Button variant="gold" size="sm" onClick={submit} disabled={pending || !csv.trim()}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {pending ? "Importing..." : "Import"}
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
}

// Minimal CSV line parser — handles quoted strings with commas inside.
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQ = false; }
      else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}
