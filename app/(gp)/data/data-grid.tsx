"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { Search, ChevronUp, ChevronDown, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { DATA_METRICS, type DataMetricKey } from "@/lib/data-metrics";
import type { DataMatrixCompany } from "@/lib/dashboard-data";
import { updateMetricCell } from "./actions";

type View = "by_company" | "by_quarter";
type SortKey = "name" | "sector" | "country" | "stage";
type SortDir = "asc" | "desc";

interface Props {
  quarters: string[];
  companies: DataMatrixCompany[];
}

export function DataGrid({ quarters, companies: initial }: Props) {
  const [companies, setCompanies] = useState(initial);
  const [view, setView] = useState<View>("by_company");
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [savedCell, setSavedCell] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

    // Optimistic local update
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
              placeholder="Filter companies, sectors, countries…"
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
              By company
            </button>
            <button
              type="button"
              onClick={() => setView("by_quarter")}
              className={cn(
                "h-7 px-2.5 rounded-md text-[11px] font-medium",
                view === "by_quarter" ? "bg-navy text-white" : "text-muted hover:text-ink"
              )}
            >
              By quarter
            </button>
          </div>
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
              sortKey={sortKey}
              sortDir={sortDir}
              toggleSort={toggleSort}
              saveCell={saveCell}
              savingCell={savingCell}
              savedCell={savedCell}
              cellId={cellId}
            />
          ) : (
            <ByQuarter
              quarters={quarters}
              companies={filtered}
              saveCell={saveCell}
              savingCell={savingCell}
              savedCell={savedCell}
              cellId={cellId}
            />
          )}
        </div>
      </div>

      <div className="text-[11px] text-muted">
        Tip: tab to move between cells. Numbers can have commas. Empty saves as null.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// View 1: rows = companies, cols = quarters × metrics (grouped by metric)
// ---------------------------------------------------------------------------

function ByCompany({
  quarters, companies, sortKey, sortDir, toggleSort, saveCell, savingCell, savedCell, cellId,
}: {
  quarters: string[];
  companies: DataMatrixCompany[];
  sortKey: SortKey;
  sortDir: SortDir;
  toggleSort: (k: SortKey) => void;
  saveCell: (companyId: string, quarter: string, key: DataMetricKey, raw: string) => void;
  savingCell: string | null;
  savedCell: string | null;
  cellId: (companyId: string, quarter: string, key: string) => string;
}) {
  return (
    <table className="w-full text-[12px] tabular-nums">
      <thead className="bg-paper2 text-[10px] tracking-[0.14em] uppercase text-muted">
        <tr>
          <SortHeader k="name" current={sortKey} dir={sortDir} onClick={toggleSort} className="sticky left-0 bg-paper2 z-10 min-w-[180px]">
            Company
          </SortHeader>
          {DATA_METRICS.map((m) => (
            <th key={m.key} colSpan={quarters.length} className="px-2 py-2 text-center font-semibold border-l border-line">
              {m.label}
            </th>
          ))}
        </tr>
        <tr className="border-t border-line">
          <th className="sticky left-0 bg-paper2 z-10"></th>
          {DATA_METRICS.map((m) =>
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
                  <img src={c.logoUrl} alt={c.name} className="h-6 w-6 rounded object-contain bg-white border border-line" />
                ) : (
                  <span className="h-6 w-6 rounded bg-navy text-gold text-[10px] font-bold inline-flex items-center justify-center">
                    {c.name[0]}
                  </span>
                )}
                <span className="font-medium text-ink truncate">{c.name}</span>
              </Link>
            </td>
            {DATA_METRICS.map((m) =>
              quarters.map((q) => {
                const id = cellId(c.id, q, m.key);
                const value = c.metrics[q]?.[m.key as DataMetricKey] ?? null;
                return (
                  <Cell
                    key={id}
                    id={id}
                    value={value}
                    metricType={m.type}
                    saving={savingCell === id}
                    saved={savedCell === id}
                    onCommit={(raw) => saveCell(c.id, q, m.key as DataMetricKey, raw)}
                  />
                );
              })
            )}
          </tr>
        ))}
        {companies.length === 0 && (
          <tr>
            <td colSpan={1 + DATA_METRICS.length * quarters.length} className="px-4 py-8 text-center text-muted text-[12px]">
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
  quarters, companies, saveCell, savingCell, savedCell, cellId,
}: {
  quarters: string[];
  companies: DataMatrixCompany[];
  saveCell: (companyId: string, quarter: string, key: DataMetricKey, raw: string) => void;
  savingCell: string | null;
  savedCell: string | null;
  cellId: (companyId: string, quarter: string, key: string) => string;
}) {
  // Reverse so newest quarter is on top
  const orderedQuarters = [...quarters].reverse();

  return (
    <table className="w-full text-[12px] tabular-nums">
      <thead className="bg-paper2 text-[10px] tracking-[0.14em] uppercase text-muted">
        <tr>
          <th className="sticky left-0 bg-paper2 z-10 px-3 py-2 text-left font-semibold min-w-[120px]">Quarter</th>
          <th className="px-3 py-2 text-left font-semibold border-l border-line min-w-[180px]">Company</th>
          {DATA_METRICS.map((m) => (
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
              {DATA_METRICS.map((m) => {
                const id = cellId(c.id, q, m.key);
                const value = c.metrics[q]?.[m.key as DataMetricKey] ?? null;
                return (
                  <Cell
                    key={id}
                    id={id}
                    value={value}
                    metricType={m.type}
                    saving={savingCell === id}
                    saved={savedCell === id}
                    onCommit={(raw) => saveCell(c.id, q, m.key as DataMetricKey, raw)}
                    align="right"
                  />
                );
              })}
            </tr>
          ))
        )}
        {companies.length === 0 && (
          <tr>
            <td colSpan={2 + DATA_METRICS.length} className="px-4 py-8 text-center text-muted text-[12px]">
              No companies match your filter.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Editable cell — input on focus, formatted display on blur
// ---------------------------------------------------------------------------

function Cell({
  id, value, metricType, saving, saved, onCommit, align = "right",
}: {
  id: string;
  value: number | null;
  metricType: "currency" | "number" | "percent";
  saving: boolean;
  saved: boolean;
  onCommit: (raw: string) => void;
  align?: "left" | "right";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value == null ? "" : String(value));

  const display = value == null
    ? "—"
    : metricType === "currency"
      ? value.toLocaleString("en-US", { maximumFractionDigits: 0 })
      : value.toLocaleString("en-US");

  if (!editing) {
    return (
      <td
        onClick={() => { setDraft(value == null ? "" : String(value)); setEditing(true); }}
        className={cn(
          "px-2 py-1.5 border-l border-line/50 cursor-text whitespace-nowrap",
          align === "right" ? "text-right" : "text-left",
          value == null && "text-muted/60",
          saved && "bg-teal-50 transition-colors",
          saving && "bg-gold-50 transition-colors"
        )}
      >
        <span className="inline-flex items-center gap-1.5">
          {display}
          {saving && <Loader2 className="h-3 w-3 animate-spin text-muted" />}
          {saved && !saving && <Check className="h-3 w-3 text-teal-600" />}
        </span>
      </td>
    );
  }

  return (
    <td className="px-1 py-1 border-l border-line/50">
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
