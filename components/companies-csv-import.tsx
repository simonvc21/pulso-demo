"use client";

import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Upload, FileText, X, AlertTriangle, Download, Sparkles, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseCompaniesCsv, type ParsedCompanyRow } from "@/lib/csv-companies";
import type { CompanyDraft, MetricDraft } from "@/app/onboarding/actions";
import type { ParsedSheet } from "@/lib/xlsx-multi-sheet";
import type { SheetMapping } from "@/lib/import-normalize";

const XLSX_EXTENSIONS = /\.(xlsx|xlsm|xls|xlsb|ods)$/i;

const SAMPLE_CSV = [
  "name,sector,country,stage,invested_usd,ownership_pct,founder,founder_email",
  "Vextra,Fintech,MX,Seed,500000,8.5,Ana Garcia,ana@vextra.io",
  "Zendro,SaaS,BR,Series A,1500000,12,Lucas Silva,lucas@zendro.com",
  "Patio,Logistics,CO,Pre-seed,250000,15,Maria Lopez,maria@patio.co",
].join("\n");

interface Props {
  /** Called with the parsed companies + (optional) historical metric drafts. */
  onImport: (rows: CompanyDraft[], metrics?: MetricDraft[]) => void;
  buttonLabel?: string;
}

export function CompaniesCsvImport({ onImport, buttonLabel = "Upload CSV / Excel" }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Upload className="h-3.5 w-3.5" /> {buttonLabel}
      </Button>
      {open && (
        <ImportModal
          onClose={() => setOpen(false)}
          onImport={(rows, metrics) => { onImport(rows, metrics); setOpen(false); }}
        />
      )}
    </>
  );
}

interface AiState {
  sheets: ParsedSheet[];
  mappings: SheetMapping[];
  summary: string;
  companies: CompanyDraft[];
  metrics: MetricDraft[];
}

function ImportModal({
  onClose, onImport,
}: { onClose: () => void; onImport: (rows: CompanyDraft[], metrics?: MetricDraft[]) => void }) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ReturnType<typeof parseCompaniesCsv> | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AiState | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleText = (val: string) => {
    setText(val);
    setFileError(null);
    setAiResult(null);
    setParsed(val.trim() ? parseCompaniesCsv(val) : null);
  };

  const handleFile = (file: File) => {
    if (file.size > 5_000_000) {
      setFileError("File is larger than 5 MB. Trim it down.");
      return;
    }
    setAiResult(null);
    setParsed(null);
    const isXlsx = XLSX_EXTENSIONS.test(file.name);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        if (isXlsx) {
          const { xlsxFileToAllSheets, csvSample } = await import("@/lib/xlsx-multi-sheet");
          const buf = reader.result as ArrayBuffer;
          const { sheets, primary } = xlsxFileToAllSheets(buf);
          if (!primary) {
            setFileError("Workbook has no sheets with data.");
            return;
          }
          // If the file is "simple enough" (1 sheet, recognizable headers),
          // try the manual parser first — it's instant and free.
          if (sheets.length === 1) {
            const tryParse = parseCompaniesCsv(primary.csv);
            if (tryParse.errors.length === 0 && tryParse.rows.length > 0) {
              setText(primary.csv);
              setParsed(tryParse);
              return;
            }
          }
          // Otherwise: kick off AI analysis on all sheets.
          await runAiAnalyze(sheets);
        } else {
          const txt = typeof reader.result === "string" ? reader.result : "";
          handleText(txt);
        }
      } catch (err: any) {
        setFileError(err?.message ?? "Could not read file");
      }
    };
    reader.onerror = () => setFileError("File read failed");
    if (isXlsx) reader.readAsArrayBuffer(file); else reader.readAsText(file);
  };

  const runAiAnalyze = async (sheets: ParsedSheet[]) => {
    setAnalyzing(true);
    setFileError(null);
    try {
      const { csvSample } = await import("@/lib/xlsx-multi-sheet");
      const { applyMappings } = await import("@/lib/import-normalize");

      const samples = sheets
        .filter((s) => s.rowCount > 0)
        .slice(0, 40) // cap so we don't blow token budget on 100-sheet workbooks
        .map((s) => ({
          name: s.name,
          rowCount: s.rowCount,
          sample: csvSample(s.csv, 8),
        }));

      const res = await fetch("/api/import/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheets: samples, intent: "both" }),
      });

      // L.8j — Vercel Hobby caps function duration at 10s. If the AI route
      // exceeds it, Vercel returns a plain-text error page that JSON.parse
      // would choke on. Read as text first, parse defensively, and fall
      // back to a heuristic mapping so the user can still proceed.
      const rawText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        if (res.status === 504 || /timeout/i.test(rawText) || /timed out/i.test(rawText)) {
          // Fall back: build a heuristic mapping client-side. Every sheet
          // becomes shape=metrics_only with the sheet name as the company.
          // Column wiring is empty, but the user gets the company list.
          const fallbackMappings: SheetMapping[] = sheets.map((s) => ({
            sheetName: s.name,
            shape: s.rowCount > 0 ? "metrics_only" : "ignored",
            companyNameOverride: s.name,
            columns: {},
            notes: "Server timed out. Using heuristic mapping (sheet name = company name). Edit columns manually if needed.",
          }));
          const normalized = applyMappings(sheets, fallbackMappings);
          const fallbackMetrics: MetricDraft[] = normalized.metrics.map((m) => ({
            companySlug: slugify(m.companyName),
            quarter: m.period,
            arrUsd: m.arr, burnUsd: m.burn, cashUsd: m.cash,
            revenueUsd: m.revenue, headcount: m.headcount,
          }));
          setAiResult({
            sheets,
            mappings: fallbackMappings,
            summary: "AI analysis timed out. Imported all sheets using sheet name as company name (no metric column wiring).",
            companies: normalized.companies,
            metrics: fallbackMetrics,
          });
          return;
        }
        setFileError(`Server returned non-JSON response: ${rawText.slice(0, 120)}`);
        return;
      }

      if (!res.ok) {
        setFileError(data?.error ?? "AI analysis failed");
        return;
      }
      const mappings: SheetMapping[] = data.mappings;
      const normalized = applyMappings(sheets, mappings);

      // Convert NormalizedMetric → MetricDraft (companies-by-name lookup happens
      // server-side in importMetrics, so we pass companyName as the slug for now).
      const metrics: MetricDraft[] = normalized.metrics.map((m) => ({
        companySlug: slugify(m.companyName),
        quarter: m.period,
        arrUsd: m.arr,
        burnUsd: m.burn,
        cashUsd: m.cash,
        revenueUsd: m.revenue,
        headcount: m.headcount,
      }));

      setAiResult({
        sheets,
        mappings,
        summary: data.summary ?? "",
        companies: normalized.companies,
        metrics,
      });
    } catch (err: any) {
      setFileError(err?.message ?? "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pulso-companies-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (typeof document === "undefined") return null;

  const canImport = (parsed && parsed.rows.length > 0 && parsed.errors.length === 0) || (aiResult && aiResult.companies.length > 0);

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
            <h2 className="text-base font-semibold text-ink">Import portfolio companies</h2>
            <p className="text-[11px] text-muted mt-0.5">
              CSV or Excel. Multi-sheet Airtable exports get analyzed by AI to auto-detect the structure.
            </p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink"><X className="h-4 w-4" /></button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="bg-paper rounded-xl border-2 border-dashed border-line hover:border-navy px-5 py-6 text-center transition-colors group"
            >
              <Upload className="h-5 w-5 mx-auto text-muted group-hover:text-navy" />
              <div className="mt-2 text-sm font-medium text-ink">Upload .csv or .xlsx file</div>
              <div className="text-[11px] text-muted mt-0.5">Max 5 MB · all sheets analyzed</div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xlsm,.xls,.xlsb,.ods,text/csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </button>
            <button
              type="button"
              onClick={downloadSample}
              className="bg-paper rounded-xl border border-line hover:border-navy px-5 py-6 text-center transition-colors group"
            >
              <Download className="h-5 w-5 mx-auto text-muted group-hover:text-navy" />
              <div className="mt-2 text-sm font-medium text-ink">Download template</div>
              <div className="text-[11px] text-muted mt-0.5">8 columns, with examples</div>
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
              placeholder="name,sector,country,stage,invested_usd,ownership_pct,founder,founder_email"
              className="w-full px-3 py-2 rounded-lg border border-line text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal/30"
            />
          </div>

          {analyzing && (
            <div className="rounded-lg border border-gold/40 bg-gold-50 px-4 py-3 flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-gold-600" />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-ink inline-flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-gold-600" /> Analyzing your spreadsheet…
                </div>
                <p className="text-[11px] text-muted mt-0.5">
                  Detecting sheet shapes, mapping headers, identifying period columns. Takes ~10 seconds.
                </p>
              </div>
            </div>
          )}

          {aiResult && <AiPreview state={aiResult} />}
          {!aiResult && parsed && <ManualPreview parsed={parsed} />}

          {fileError && (
            <div className="rounded-lg border border-coral/40 bg-coral/10 px-3 py-2 text-xs text-coral">
              {fileError}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 px-6 py-4 border-t border-line shrink-0 bg-paper2/40">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant="gold"
            size="sm"
            onClick={() => {
              if (aiResult) {
                onImport(aiResult.companies, aiResult.metrics);
              } else if (parsed) {
                onImport(parsed.rows.map(stripLine));
              }
            }}
            disabled={!canImport}
          >
            {aiResult && aiResult.companies.length > 0 ? (
              `Add ${aiResult.companies.length} compan${aiResult.companies.length === 1 ? "y" : "ies"}` +
              (aiResult.metrics.length > 0 ? ` + ${aiResult.metrics.length} metric rows` : "")
            ) : parsed && parsed.rows.length > 0 ? (
              `Add ${parsed.rows.length} compan${parsed.rows.length === 1 ? "y" : "ies"}`
            ) : "Import"}
          </Button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function stripLine(r: ParsedCompanyRow): CompanyDraft {
  const { lineNumber: _ln, ...rest } = r;
  return rest;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

// ---------------------------------------------------------------------------
// AI preview — shows the per-sheet mapping the model returned + the resulting
// companies and metrics counts.
// ---------------------------------------------------------------------------

function AiPreview({ state }: { state: AiState }) {
  return (
    <div className="rounded-xl border border-gold/40 bg-gold-50/50 px-4 py-3 space-y-3">
      <div className="flex items-center gap-2 text-[12px]">
        <Sparkles className="h-3.5 w-3.5 text-gold-600" />
        <span className="font-semibold text-ink">AI mapping</span>
        <span className="text-muted">·</span>
        <span className="text-teal-600 font-semibold">{state.companies.length} companies</span>
        {state.metrics.length > 0 && (
          <>
            <span className="text-muted">·</span>
            <span className="text-teal-600 font-semibold">{state.metrics.length} metric rows</span>
          </>
        )}
      </div>

      {state.summary && (
        <p className="text-[11px] text-ink/80 leading-relaxed">{state.summary}</p>
      )}

      <div className="rounded-lg border border-line bg-white overflow-hidden">
        <div className="px-3 py-1.5 bg-paper2 border-b border-line text-[10px] font-semibold text-muted tracking-[0.14em] uppercase">
          Sheets
        </div>
        <ul className="divide-y divide-line max-h-48 overflow-y-auto">
          {state.mappings.map((m, i) => (
            <li key={i} className="px-3 py-2 text-[11px] flex items-start gap-2">
              <span className={cn(
                "shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-semibold",
                m.shape === "ignored" ? "bg-paper2 text-muted" :
                m.shape === "metrics_only" ? "bg-teal-50 text-teal-600" :
                m.shape === "companies_long" ? "bg-gold-50 text-gold-600" :
                "bg-navy text-white"
              )}>
                {m.shape.replace("_", " ")}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-ink truncate">
                  {m.sheetName}
                  {m.companyNameOverride && <span className="text-muted font-normal"> · {m.companyNameOverride}</span>}
                </div>
                {m.notes && <div className="text-muted text-[10px] mt-0.5">{m.notes}</div>}
                {m.columns && typeof m.columns === "object" && Object.keys(m.columns).length > 0 && (
                  <div className="text-muted text-[10px] mt-0.5">
                    {Object.entries(m.columns).map(([k, v]) => v?.source ? `${k}:${v.source}` : null).filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {state.companies.length > 0 && (
        <div className="rounded-lg border border-line bg-white max-h-48 overflow-y-auto">
          <table className="w-full text-[11px]">
            <thead className="bg-paper2 text-muted sticky top-0">
              <tr className="text-left">
                <th className="px-2 py-1.5 font-semibold">Name</th>
                <th className="px-2 py-1.5 font-semibold">Sector</th>
                <th className="px-2 py-1.5 font-semibold">Country</th>
                <th className="px-2 py-1.5 font-semibold">Stage</th>
                <th className="px-2 py-1.5 font-semibold text-right">Invested</th>
                <th className="px-2 py-1.5 font-semibold">Founder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {state.companies.slice(0, 60).map((c, i) => (
                <tr key={i} className="text-ink">
                  <td className="px-2 py-1 font-medium">{c.name}</td>
                  <td className="px-2 py-1">{c.sector ?? "—"}</td>
                  <td className="px-2 py-1">{c.country ?? "—"}</td>
                  <td className="px-2 py-1">{c.stage}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{c.investedUsd ? `$${c.investedUsd.toLocaleString()}` : "—"}</td>
                  <td className="px-2 py-1">{c.founderName ?? "—"}</td>
                </tr>
              ))}
              {state.companies.length > 60 && (
                <tr className="text-muted text-[10px]">
                  <td colSpan={6} className="px-2 py-1 italic">… and {state.companies.length - 60} more</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manual (deterministic) preview — preserved for CSV paste path.
// ---------------------------------------------------------------------------

function ManualPreview({ parsed }: { parsed: ReturnType<typeof parseCompaniesCsv> }) {
  const hasErrors = parsed.errors.length > 0;
  return (
    <div className="rounded-xl border border-line bg-paper2/40 px-4 py-3">
      <div className="flex items-center gap-3 flex-wrap text-[11px]">
        <span className="inline-flex items-center gap-1.5 text-teal-600 font-semibold">
          <FileText className="h-3 w-3" /> {parsed.rows.length} compan{parsed.rows.length === 1 ? "y" : "ies"}
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
        </ul>
      )}

      {parsed.rows.length > 0 && (
        <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-line bg-white">
          <table className="w-full text-[11px]">
            <thead className="bg-paper2 text-muted sticky top-0">
              <tr className="text-left">
                <th className="px-2 py-1.5 font-semibold">Name</th>
                <th className="px-2 py-1.5 font-semibold">Sector</th>
                <th className="px-2 py-1.5 font-semibold">Country</th>
                <th className="px-2 py-1.5 font-semibold">Stage</th>
                <th className="px-2 py-1.5 font-semibold text-right tabular-nums">Invested</th>
                <th className="px-2 py-1.5 font-semibold text-right tabular-nums">Own%</th>
                <th className="px-2 py-1.5 font-semibold">Founder</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y divide-line", hasErrors && "opacity-60")}>
              {parsed.rows.slice(0, 60).map((r, i) => (
                <tr key={i} className="text-ink">
                  <td className="px-2 py-1 font-medium">{r.name}</td>
                  <td className="px-2 py-1">{r.sector ?? "—"}</td>
                  <td className="px-2 py-1">{r.country ?? "—"}</td>
                  <td className="px-2 py-1">{r.stage}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{r.investedUsd ? `$${r.investedUsd.toLocaleString()}` : "—"}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{r.ownershipPct || "—"}</td>
                  <td className="px-2 py-1">{r.founderName ?? "—"}</td>
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
