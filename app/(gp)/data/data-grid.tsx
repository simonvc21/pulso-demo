"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import { Search, ChevronUp, ChevronDown, Loader2, Check, MessageSquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { DATA_METRICS, type DataMetricKey } from "@/lib/data-metrics";
import type { DataMatrixCompany, DataMetricNotes } from "@/lib/dashboard-data";
import type { DataColumnsConfig } from "@/lib/data-columns-config";
import { updateMetricCell } from "./actions";
import { ColumnConfigPopover } from "./column-config-popover";
import { CellNotePopover } from "./cell-note-popover";

type View = "by_company" | "by_quarter" | "per_company";
type SortKey = "name" | "sector" | "country" | "stage";
type SortDir = "asc" | "desc";

type DataMetricEntry = (typeof DATA_METRICS)[number];

const METRIC_BY_KEY: Record<DataMetricKey, DataMetricEntry> = Object.fromEntries(
  DATA_METRICS.map((m) => [m.key, m])
) as Record<DataMetricKey, DataMetricEntry>;

interface Props {
  quarters: string[];
  companies: DataMatrixCompany[];
  initialNotes: DataMetricNotes;
  initialColumns: DataColumnsConfig;
  /** Localized strings passed from the server page (avoids importing i18n into client bundle). */
  dict?: Record<string, string>;
}

interface NoteEditTarget {
  companyId: string;
  companyName: string;
  quarter: string;
  metricKey: DataMetricKey;
  metricLabel: string;
  anchorRect: DOMRect;
}

const noteKey = (companyId: string, quarter: string, key: string) =>
  `${companyId}|${quarter}|${key}`;

export function DataGrid({ quarters, companies: initial, initialNotes, initialColumns, dict = {} }: Props) {
  const td = (k: string, fallback: string) => dict[k] ?? fallback;
  const [companies, setCompanies] = useState(initial);
  const [view, setView] = useState<View>("by_company");
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [savedCell, setSavedCell] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // L.3 — column config + per-cell notes (both client-state, server-persisted)
  const [columns, setColumns] = useState<DataColumnsConfig>(initialColumns);
  const [notes, setNotes] = useState<DataMetricNotes>(initialNotes);
  const [noteTarget, setNoteTarget] = useState<NoteEditTarget | null>(null);

  const orderedMetrics = useMemo(() => {
    const hidden = new Set(columns.hidden);
    return columns.order.filter((k) => !hidden.has(k)).map((k) => METRIC_BY_KEY[k]);
  }, [columns]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let rows = !q ? companies : companies.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.sector ?? "").toLowerCase().includes(q) ||
      (c.country ?? "").toLowerCase().includes(q)
    );
    rows = [...rows].sort((a, b) => {
      const av = (a[sortKey] ?? "") as string;
      const bv = (b[sortKey] ?? "") as string;
      const cmp = av.localeCompare(bv);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [companies, filter, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };

  const cellId = (companyId: string, quarter: string, key: string) =>
    `${companyId}|${quarter}|${key}`;

  const saveCell = async (
    companyId: string,
    quarter: string,
    key: DataMetricKey,
    rawValue: string
  ) => {
    setError(null);
    const trimmed = rawValue.trim();
    const value = trimmed === "" ? null : Number(trimmed.replace(/,/g, ""));
    if (trimmed !== "" && !Number.isFinite(value)) {
      setError(`"${rawValue}" is not a number`);
      return;
    }

    setCompanies((prev) => prev.map((c) => {
      if (c.id !== companyId) return c;
      const next = { ...c, metrics: { ...c.metrics } };
      next.metrics[quarter] = {
        ...(c.metrics[quarter] ?? { arr_usd: null, burn_usd: null, cash_usd: null, revenue_usd: null, headcount: null }),
        [key]: value as number | null,
      };
      return next;
    }));

    const id = cellId(companyId, quarter, key);
    setSavingCell(id);
    const res = await updateMetricCell({ companyId, quarter, key, value: value as number | null });
    setSavingCell(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSavedCell(id);
    setTimeout(() => setSavedCell((cur) => (cur === id ? null : cur)), 1200);
  };

  const openNote = (
    companyId: string,
    companyName: string,
    quarter: string,
    metricKey: DataMetricKey,
    anchor: HTMLElement,
  ) => {
    setNoteTarget({
      companyId,
      companyName,
      quarter,
      metricKey,
      metricLabel: METRIC_BY_KEY[metricKey].label,
      anchorRect: anchor.getBoundingClientRect(),
    });
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={td("filter_placeholder", "Filter companies, sectors, countries…")}
              className="h-9 pl-8 pr-3 w-72 rounded-lg bg-paper border border-line text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-teal/30"
            />
          </div>
          <div className="inline-flex rounded-lg border border-line bg-white p-0.5">
            <button
              type="button"
              onClick={() => setView("by_company")}
              className={cn(
                "h-7 px-2.5 rounded-md text-[11px] font-medium",
                view === "by_company" ? "bg-navy text-white" : "text-muted hover:text-ink"
              )}
            >
              {td("by_company", "By company")}
            </button>
            <button
              type="button"
              onClick={() => setView("by_quarter")}
              className={cn(
                "h-7 px-2.5 rounded-md text-[11px] font-medium",
                view === "by_quarter" ? "bg-navy text-white" : "text-muted hover:text-ink"
              )}
            >
              {td("by_quarter", "By quarter")}
            </button>
            <button
              type="button"
              onClick={() => setView("per_company")}
              className={cn(
                "h-7 px-2.5 rounded-md text-[11px] font-medium",
                view === "per_company" ? "bg-navy text-white" : "text-muted hover:text-ink"
              )}
            >
              {td("per_company", "Per company")}
            </button>
          </div>
          <ColumnConfigPopover config={columns} onChange={setColumns} />
        </div>
        {error && (
          <div className="text-[12px] text-coral bg-red-50 border border-red-100 rounded-md px-3 py-1.5">
            {error}
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="bg-white rounded-xl border border-line shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          {view === "by_company" ? (
            <ByCompany
              quarters={quarters}
              companies={filtered}
              metrics={orderedMetrics}
              sortKey={sortKey}
              sortDir={sortDir}
              toggleSort={toggleSort}
              saveCell={saveCell}
              savingCell={savingCell}
              savedCell={savedCell}
              cellId={cellId}
              notes={notes}
              openNote={openNote}
            />
          ) : view === "by_quarter" ? (
            <ByQuarter
              quarters={quarters}
              companies={filtered}
              metrics={orderedMetrics}
              saveCell={saveCell}
              savingCell={savingCell}
              savedCell={savedCell}
              cellId={cellId}
              notes={notes}
              openNote={openNote}
            />
          ) : (
            <PerCompany
              quarters={quarters}
              companies={filtered}
              metrics={orderedMetrics}
              saveCell={saveCell}
              savingCell={savingCell}
              savedCell={savedCell}
              cellId={cellId}
              notes={notes}
              openNote={openNote}
            />
          )}
        </div>
      </div>

      <div className="text-[11px] text-muted">
        {td("tip", "Tip: tab to move between cells. Right-click any cell (or click the bubble) to add a note. Empty saves as null.")}
      </div>

      {noteTarget && (
        <CellNotePopover
          companyId={noteTarget.companyId}
          companyName={noteTarget.companyName}
          quarter={noteTarget.quarter}
          metricKey={noteTarget.metricKey}
          metricLabel={noteTarget.metricLabel}
          initialNote={notes[noteKey(noteTarget.companyId, noteTarget.quarter, noteTarget.metricKey)] ?? ""}
          anchorRect={noteTarget.anchorRect}
          onClose={() => setNoteTarget(null)}
          onSaved={(text) => setNotes((n) => ({ ...n, [noteKey(noteTarget.companyId, noteTarget.quarter, noteTarget.metricKey)]: text }))}
          onDeleted={() => setNotes((n) => {
            const next = { ...n };
            delete next[noteKey(noteTarget.companyId, noteTarget.quarter, noteTarget.metricKey)];
            return next;
          })}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// View 1: rows = companies, cols = quarters × metrics (grouped by metric)
// ---------------------------------------------------------------------------

function ByCompany({
  quarters, companies, metrics, sortKey, sortDir, toggleSort, saveCell, savingCell, savedCell, cellId, notes, openNote,
}: {
  quarters: string[];
  companies: DataMatrixCompany[];
  metrics: DataMetricEntry[];
  sortKey: SortKey;
  sortDir: SortDir;
  toggleSort: (k: SortKey) => void;
  saveCell: (companyId: string, quarter: string, key: DataMetricKey, raw: string) => void;
  savingCell: string | null;
  savedCell: string | null;
  cellId: (companyId: string, quarter: string, key: string) => string;
  notes: DataMetricNotes;
  openNote: (companyId: string, companyName: string, quarter: string, key: DataMetricKey, anchor: HTMLElement) => void;
}) {
  if (metrics.length === 0) {
    return <EmptyMetrics />;
  }
  return (
    <table className="w-full text-[12px] tabular-nums">
      <thead className="bg-paper2 text-[10px] tracking-[0.14em] uppercase text-muted">
        <tr>
          <SortHeader k="name" current={sortKey} dir={sortDir} onClick={toggleSort} className="sticky left-0 bg-paper2 z-10 min-w-[180px]">
            Company
          </SortHeader>
          {metrics.map((m) => (
            <th key={m.key} colSpan={quarters.length} className="px-2 py-2 text-center font-semibold border-l border-line">
              {m.label}
            </th>
          ))}
        </tr>
        <tr className="border-t border-line">
          <th className="sticky left-0 bg-paper2 z-10"></th>
          {metrics.map((m) =>
            quarters.map((q) => (
              <th key={`${m.key}-${q}`} className="px-2 py-1.5 text-center font-medium text-[10px] border-l border-line/50">
                {q}
              </th>
            ))
          )}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {companies.map((c) => (
          <tr key={c.id} className="hover:bg-paper">
            <td className="sticky left-0 bg-white z-10 px-3 py-2 border-r border-line min-w-[180px]">
              <Link href={`/companies/${c.slug}`} className="flex items-center gap-2 hover:text-teal-600">
                {c.logoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={c.logoUrl} alt={c.name} data-keep-white="true" className="h-6 w-6 rounded object-contain bg-white border border-line" />
                ) : (
                  <span className="h-6 w-6 rounded bg-navy text-gold text-[10px] font-bold inline-flex items-center justify-center">
                    {c.name[0]}
                  </span>
                )}
                <span className="font-medium text-ink truncate">{c.name}</span>
              </Link>
            </td>
            {metrics.map((m) =>
              quarters.map((q) => {
                const id = cellId(c.id, q, m.key);
                const value = c.metrics[q]?.[m.key as DataMetricKey] ?? null;
                const note = notes[noteKey(c.id, q, m.key)] ?? null;
                return (
                  <Cell
                    key={id}
                    id={id}
                    value={value}
                    metricType={m.type}
                    saving={savingCell === id}
                    saved={savedCell === id}
                    note={note}
                    onCommit={(raw) => saveCell(c.id, q, m.key as DataMetricKey, raw)}
                    onOpenNote={(anchor) => openNote(c.id, c.name, q, m.key as DataMetricKey, anchor)}
                  />
                );
              })
            )}
          </tr>
        ))}
        {companies.length === 0 && (
          <tr>
            <td colSpan={1 + metrics.length * quarters.length} className="px-4 py-8 text-center text-muted text-[12px]">
              No companies match your filter.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// View 2: rows = quarter × company, cols = metrics. Tighter for cross-quarter audit.
// ---------------------------------------------------------------------------

function ByQuarter({
  quarters, companies, metrics, saveCell, savingCell, savedCell, cellId, notes, openNote,
}: {
  quarters: string[];
  companies: DataMatrixCompany[];
  metrics: DataMetricEntry[];
  saveCell: (companyId: string, quarter: string, key: DataMetricKey, raw: string) => void;
  savingCell: string | null;
  savedCell: string | null;
  cellId: (companyId: string, quarter: string, key: string) => string;
  notes: DataMetricNotes;
  openNote: (companyId: string, companyName: string, quarter: string, key: DataMetricKey, anchor: HTMLElement) => void;
}) {
  if (metrics.length === 0) return <EmptyMetrics />;

  const orderedQuarters = [...quarters].reverse();

  return (
    <table className="w-full text-[12px] tabular-nums">
      <thead className="bg-paper2 text-[10px] tracking-[0.14em] uppercase text-muted">
        <tr>
          <th className="sticky left-0 bg-paper2 z-10 px-3 py-2 text-left font-semibold min-w-[120px]">Quarter</th>
          <th className="px-3 py-2 text-left font-semibold border-l border-line min-w-[180px]">Company</th>
          {metrics.map((m) => (
            <th key={m.key} className="px-3 py-2 text-right font-semibold border-l border-line">
              {m.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {orderedQuarters.flatMap((q) =>
          companies.map((c, i) => (
            <tr key={`${q}-${c.id}`} className="hover:bg-paper">
              {i === 0 && (
                <td
                  className="sticky left-0 bg-white z-10 px-3 py-2 border-r border-line align-top text-ink font-medium"
                  rowSpan={companies.length}
                >
                  {q}
                </td>
              )}
              <td className="px-3 py-2 border-l border-line">
                <Link href={`/companies/${c.slug}`} className="text-ink hover:text-teal-600 font-medium">
                  {c.name}
                </Link>
              </td>
              {metrics.map((m) => {
                const id = cellId(c.id, q, m.key);
                const value = c.metrics[q]?.[m.key as DataMetricKey] ?? null;
                const note = notes[noteKey(c.id, q, m.key)] ?? null;
                return (
                  <Cell
                    key={id}
                    id={id}
                    value={value}
                    metricType={m.type}
                    saving={savingCell === id}
                    saved={savedCell === id}
                    note={note}
                    onCommit={(raw) => saveCell(c.id, q, m.key as DataMetricKey, raw)}
                    onOpenNote={(anchor) => openNote(c.id, c.name, q, m.key as DataMetricKey, anchor)}
                    align="right"
                  />
                );
              })}
            </tr>
          ))
        )}
        {companies.length === 0 && (
          <tr>
            <td colSpan={2 + metrics.length} className="px-4 py-8 text-center text-muted text-[12px]">
              No companies match your filter.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// View 3: one card per company, rows = metrics, cols = quarters
// (closer to a per-company P&L; how funds usually look at one startup)
// ---------------------------------------------------------------------------

function PerCompany({
  quarters, companies, metrics, saveCell, savingCell, savedCell, cellId, notes, openNote,
}: {
  quarters: string[];
  companies: DataMatrixCompany[];
  metrics: DataMetricEntry[];
  saveCell: (companyId: string, quarter: string, key: DataMetricKey, raw: string) => void;
  savingCell: string | null;
  savedCell: string | null;
  cellId: (companyId: string, quarter: string, key: string) => string;
  notes: DataMetricNotes;
  openNote: (companyId: string, companyName: string, quarter: string, key: DataMetricKey, anchor: HTMLElement) => void;
}) {
  if (metrics.length === 0) return <EmptyMetrics />;
  if (companies.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-muted text-[12px]">
        No companies match your filter.
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {companies.map((c) => (
        <div key={c.id} className="bg-paper rounded-xl border border-line overflow-hidden">
          {/* Company header */}
          <div className="px-4 py-3 bg-white border-b border-line flex items-center gap-3">
            {c.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={c.logoUrl} alt={c.name} data-keep-white="true" className="h-8 w-8 rounded object-contain bg-white border border-line" />
            ) : (
              <span className="h-8 w-8 rounded bg-navy text-gold text-[11px] font-bold inline-flex items-center justify-center">
                {c.name[0]}
              </span>
            )}
            <Link href={`/companies/${c.slug}`} className="text-sm font-semibold text-ink hover:text-teal-600">
              {c.name}
            </Link>
            {c.sector && <span className="text-[11px] text-muted">· {c.sector}</span>}
            {c.country && <span className="text-[11px] text-muted">· {c.country}</span>}
          </div>

          {/* Per-company table: rows = metrics, cols = quarters */}
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] tabular-nums">
              <thead className="bg-paper2 text-[10px] tracking-[0.14em] uppercase text-muted">
                <tr>
                  <th className="text-left font-semibold px-4 py-2 sticky left-0 bg-paper2 min-w-[140px] z-10 border-r border-line">Metric</th>
                  {quarters.map((q) => (
                    <th key={q} className="text-right font-semibold px-3 py-2 border-l border-line/50">
                      {q}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {metrics.map((m) => (
                  <tr key={m.key} className="hover:bg-white">
                    <td className="px-4 py-1.5 text-[12px] font-medium text-ink sticky left-0 bg-paper min-w-[140px] z-10 border-r border-line">
                      {m.label}
                    </td>
                    {quarters.map((q) => {
                      const id = cellId(c.id, q, m.key);
                      const value = c.metrics[q]?.[m.key as DataMetricKey] ?? null;
                      const note = notes[noteKey(c.id, q, m.key)] ?? null;
                      return (
                        <Cell
                          key={id}
                          id={id}
                          value={value}
                          metricType={m.type}
                          saving={savingCell === id}
                          saved={savedCell === id}
                          note={note}
                          onCommit={(raw) => saveCell(c.id, q, m.key as DataMetricKey, raw)}
                          onOpenNote={(anchor) => openNote(c.id, c.name, q, m.key as DataMetricKey, anchor)}
                          align="right"
                        />
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyMetrics() {
  return (
    <div className="py-12 text-center text-[12px] text-muted">
      All columns are hidden. Use the <strong className="text-ink">Columns</strong> button above to show some.
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editable cell — input on focus, formatted display on blur
// ---------------------------------------------------------------------------

function Cell({
  id, value, metricType, saving, saved, note, onCommit, onOpenNote, align = "right",
}: {
  id: string;
  value: number | null;
  metricType: "currency" | "number" | "percent";
  saving: boolean;
  saved: boolean;
  note: string | null;
  onCommit: (raw: string) => void;
  onOpenNote: (anchor: HTMLElement) => void;
  align?: "left" | "right";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const tdRef = useRef<HTMLTableCellElement | null>(null);

  const display = value == null
    ? "—"
    : metricType === "currency"
      ? value.toLocaleString("en-US", { maximumFractionDigits: 0 })
      : value.toLocaleString("en-US");

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (tdRef.current) onOpenNote(tdRef.current);
  };

  if (!editing) {
    return (
      <td
        ref={tdRef}
        onClick={() => { setDraft(value == null ? "" : String(value)); setEditing(true); }}
        onContextMenu={handleContextMenu}
        title={note ? `Note: ${note}` : "Right-click to add a note"}
        className={cn(
          "group relative px-2 py-1.5 border-l border-line/50 cursor-text whitespace-nowrap",
          align === "right" ? "text-right" : "text-left",
          value == null && "text-muted/60",
          saved && "bg-teal-50 transition-colors",
          saving && "bg-gold-50 transition-colors",
          note && "bg-gold-50/40"
        )}
      >
        <span className={cn("inline-flex items-center gap-1.5", align === "right" && "justify-end")}>
          {display}
          {saving && <Loader2 className="h-3 w-3 animate-spin text-muted" />}
          {saved && !saving && <Check className="h-3 w-3 text-teal-600" />}
          {note && !saving && !saved && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); if (tdRef.current) onOpenNote(tdRef.current); }}
              className="text-gold-600 hover:text-gold-700"
              aria-label="View note"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold-600" />
            </button>
          )}
          {!note && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); if (tdRef.current) onOpenNote(tdRef.current); }}
              className="opacity-0 group-hover:opacity-100 text-muted hover:text-navy transition-opacity"
              aria-label="Add a note"
            >
              <MessageSquarePlus className="h-3 w-3" />
            </button>
          )}
        </span>
      </td>
    );
  }

  return (
    <td ref={tdRef} className="px-1 py-1 border-l border-line/50">
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft !== (value == null ? "" : String(value))) onCommit(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(value == null ? "" : String(value));
            setEditing(false);
          }
        }}
        className={cn(
          "w-full h-7 px-2 rounded border border-teal text-[12px] focus:outline-none focus:ring-2 focus:ring-teal/30 tabular-nums bg-white",
          align === "right" ? "text-right" : "text-left"
        )}
      />
    </td>
  );
}

function SortHeader({
  k, current, dir, onClick, className, children,
}: {
  k: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const active = current === k;
  return (
    <th
      onClick={() => onClick(k)}
      className={cn(
        "px-3 py-2 text-left font-semibold cursor-pointer select-none",
        className
      )}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {active && (dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </span>
    </th>
  );
}
