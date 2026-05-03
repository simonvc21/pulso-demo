"use client";

import { useState, useTransition, useRef } from "react";
import { createPortal } from "react-dom";
import { Upload, FileText, X, Check, AlertTriangle, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseMetricsCsv, type ParsedMetricRow } from "@/lib/csv-metrics";
import { bulkImportMetrics } from "@/app/(gp)/data/actions";

type CommitResult = {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
};

interface Props {
  /** Trigger element label. Defaults to "Import CSV". */
  buttonLabel?: string;
  /** Visual variant for the trigger. */
  variant?: "outline" | "primary" | "gold";
  /** Called after a successful commit so the parent can refresh. */
  onComplete?: (result: CommitResult) => void;
}

const SAMPLE_CSV = [
  "company_slug,quarter,arr_usd,burn_usd,cash_usd,revenue_usd,headcount",
  "acme,Q1 2026,1500000,80000,1200000,375000,12",
  "acme,Q2 2026,1750000,85000,1100000,437500,14",
  "vextra,Q1 2026,2200000,120000,2400000,550000,22",
].join("\n");

export function MetricsCsvImport({ buttonLabel = "Import CSV", variant = "outline", onComplete }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant={variant} size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Upload className="h-3.5 w-3.5" /> {buttonLabel}
      </Button>
      {open && <ImportModal onClose={() => setOpen(false)} onComplete={onComplete} />}
    </>
  );
}

function ImportModal({ onClose, onComplete }: { onClose: () => void; onComplete?: (r: CommitResult) => void }) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ReturnType<typeof parseMetricsCsv> | null>(null);
  const [committing, startTransition] = useTransition();
  const [result, setResult] = useState<CommitResult | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleText = (val: string) => {
    setText(val);
    setResult(null);
    setServerError(null);
    setParsed(val.trim() ? parseMetricsCsv(val) : null);
  };

  const handleFile = (file: File) => {
    if (file.size > 2_000_000) {
      setServerError("File is larger than 2 MB. Trim it down or split into multiple uploads.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const txt = typeof reader.result === "string" ? reader.result : "";
      handleText(txt);
    };
    reader.readAsText(file);
  };

  const commit = () => {
    if (!parsed || parsed.rows.length === 0) return;
    setServerError(null);
    startTransition(async () => {
      const rows = parsed.rows.map((r: ParsedMetricRow) => ({
        companyKey: r.companyKey,
        quarter: r.quarter,
        arrUsd: r.arrUsd,
        burnUsd: r.burnUsd,
        cashUsd: r.cashUsd,
        revenueUsd: r.revenueUsd,
        headcount: r.headcount,
        lineNumber: r.lineNumber,
      }));
      const res = await bulkImportMetrics(rows);
      if (!res.ok) { setServerError(res.error); return; }
      setResult({ inserted: res.inserted, updated: res.updated, skipped: res.skipped, errors: res.errors });
      onComplete?.({ inserted: res.inserted, updated: res.updated, skipped: res.skipped, errors: res.errors });
    });
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pulso-metrics-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-navy/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-cardHover w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-6 py-4 border-b border-line shrink-0">
          <div>
            <h2 className="text-base font-semibold text-ink">Import metrics from CSV</h2>
            <p className="text-[11px] text-muted mt-0.5">
              One row per company × quarter. We upsert on (company, quarter) — re-uploading is safe.
            </p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Upload + paste */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="bg-paper rounded-xl border-2 border-dashed border-line hover:border-navy px-5 py-6 text-center transition-colors group"
            >
              <Upload className="h-5 w-5 mx-auto text-muted group-hover:text-navy" />
              <div className="mt-2 text-sm font-medium text-ink">Upload .csv file</div>
              <div className="text-[11px] text-muted mt-0.5">Max 2 MB</div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </button>
            <button
              type="button"
              onClick={downloadSample}
              className="bg-paper rounded-xl border border-line hover:border-navy px-5 py-6 text-center transition-colors group"
            >
              <Download className="h-5 w-5 mx-auto text-muted group-hover:text-navy" />
              <div className="mt-2 text-sm font-medium text-ink">Download template</div>
              <div className="text-[11px] text-muted mt-0.5">7 columns, with examples</div>
            </button>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-muted tracking-[0.14em] uppercase mb-1">
              …or paste CSV here
            </label>
            <textarea
              value={text}
              onChange={(e) => handleText(e.target.value)}
              rows={6}
              placeholder="company_slug,quarter,arr_usd,burn_usd,cash_usd,revenue_usd,headcount"
              className="w-full px-3 py-2 rounded-lg border border-line text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal/30"
            />
          </div>

          {/* Preview */}
          {parsed && (
            <PreviewBlock parsed={parsed} />
          )}

          {/* Server-side errors */}
          {serverError && (
            <div className="rounded-lg border border-coral/40 bg-coral/10 px-3 py-2 text-xs text-coral">
              {serverError}
            </div>
          )}

          {/* Commit result */}
          {result && (
            <div className="rounded-xl border border-teal/40 bg-teal/5 px-4 py-3 text-sm">
              <div className="flex items-center gap-2 text-teal-600 font-semibold">
                <Check className="h-4 w-4" /> Import complete
              </div>
              <div className="mt-1 text-[12px] text-ink space-y-0.5">
                <div>
                  <span className="font-semibold">{result.inserted}</span> new row{result.inserted === 1 ? "" : "s"} inserted ·{" "}
                  <span className="font-semibold">{result.updated}</span> updated ·{" "}
                  <span className="font-semibold">{result.skipped}</span> skipped
                </div>
                {result.errors.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-coral text-[11px]">
                      {result.errors.length} row{result.errors.length === 1 ? "" : "s"} skipped — see details
                    </summary>
                    <ul className="mt-1 text-[11px] text-coral list-disc pl-4 space-y-0.5">
                      {result.errors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}
                      {result.errors.length > 20 && <li>… and {result.errors.length - 20} more</li>}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 px-6 py-4 border-t border-line shrink-0 bg-paper2/40">
          <Button variant="outline" size="sm" onClick={onClose} disabled={committing}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button
              variant="gold"
              size="sm"
              className="gap-1.5"
              onClick={commit}
              disabled={committing || !parsed || parsed.rows.length === 0 || parsed.errors.length > 0}
            >
              {committing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {committing
                ? "Importing…"
                : parsed && parsed.rows.length > 0
                ? `Import ${parsed.rows.length} row${parsed.rows.length === 1 ? "" : "s"}`
                : "Import"}
            </Button>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function PreviewBlock({ parsed }: { parsed: ReturnType<typeof parseMetricsCsv> }) {
  const hasErrors = parsed.errors.length > 0;
  return (
    <div className="rounded-xl border border-line bg-paper2/40 px-4 py-3">
      <div className="flex items-center gap-3 flex-wrap text-[11px]">
        <span className="inline-flex items-center gap-1.5 text-teal-600 font-semibold">
          <FileText className="h-3 w-3" /> {parsed.rows.length} valid row{parsed.rows.length === 1 ? "" : "s"}
        </span>
        {hasErrors && (
          <span className="inline-flex items-center gap-1.5 text-coral font-semibold">
            <AlertTriangle className="h-3 w-3" /> {parsed.errors.length} error{parsed.errors.length === 1 ? "" : "s"}
          </span>
        )}
        {parsed.recognizedHeaders.length > 0 && (
          <span className="text-muted">Recognized: {parsed.recognizedHeaders.join(", ")}</span>
        )}
        {parsed.ignoredHeaders.length > 0 && (
          <span className="text-muted">Ignored: {parsed.ignoredHeaders.join(", ")}</span>
        )}
      </div>

      {hasErrors && (
        <ul className="mt-2 text-[11px] text-coral list-disc pl-4 space-y-0.5">
          {parsed.errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
          {parsed.errors.length > 8 && <li>… and {parsed.errors.length - 8} more</li>}
        </ul>
      )}

      {parsed.rows.length > 0 && (
        <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-line bg-white">
          <table className="w-full text-[11px]">
            <thead className="bg-paper2 text-muted sticky top-0">
              <tr className="text-left">
                <th className="px-2 py-1.5 font-semibold">Company</th>
                <th className="px-2 py-1.5 font-semibold">Quarter</th>
                <th className="px-2 py-1.5 font-semibold text-right tabular-nums">ARR</th>
                <th className="px-2 py-1.5 font-semibold text-right tabular-nums">Burn</th>
                <th className="px-2 py-1.5 font-semibold text-right tabular-nums">Cash</th>
                <th className="px-2 py-1.5 font-semibold text-right tabular-nums">Revenue</th>
                <th className="px-2 py-1.5 font-semibold text-right tabular-nums">FTE</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y divide-line", hasErrors && "opacity-60")}>
              {parsed.rows.slice(0, 60).map((r, i) => (
                <tr key={i} className="text-ink">
                  <td className="px-2 py-1 font-medium">{r.companyKey}</td>
                  <td className="px-2 py-1">{r.quarter}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{r.arrUsd ?? "—"}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{r.burnUsd ?? "—"}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{r.cashUsd ?? "—"}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{r.revenueUsd ?? "—"}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{r.headcount ?? "—"}</td>
                </tr>
              ))}
              {parsed.rows.length > 60 && (
                <tr className="text-muted text-[10px]">
                  <td colSpan={7} className="px-2 py-1 italic">… and {parsed.rows.length - 60} more rows</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
