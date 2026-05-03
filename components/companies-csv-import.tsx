"use client";

import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Upload, FileText, X, AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseCompaniesCsv, type ParsedCompanyRow } from "@/lib/csv-companies";
import type { CompanyDraft } from "@/app/onboarding/actions";

const XLSX_EXTENSIONS = /\.(xlsx|xlsm|xls|xlsb|ods)$/i;

const SAMPLE_CSV = [
  "name,sector,country,stage,invested_usd,ownership_pct,founder,founder_email",
  "Vextra,Fintech,MX,Seed,500000,8.5,Ana Garcia,ana@vextra.io",
  "Zendro,SaaS,BR,Series A,1500000,12,Lucas Silva,lucas@zendro.com",
  "Patio,Logistics,CO,Pre-seed,250000,15,Maria Lopez,maria@patio.co",
].join("\n");

interface Props {
  /** Called with the parsed rows so the parent can merge them into its state. */
  onImport: (rows: CompanyDraft[]) => void;
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
          onImport={(rows) => { onImport(rows); setOpen(false); }}
        />
      )}
    </>
  );
}

function ImportModal({
  onClose, onImport,
}: { onClose: () => void; onImport: (rows: CompanyDraft[]) => void }) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ReturnType<typeof parseCompaniesCsv> | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleText = (val: string) => {
    setText(val);
    setFileError(null);
    setParsed(val.trim() ? parseCompaniesCsv(val) : null);
  };

  const handleFile = (file: File) => {
    if (file.size > 2_000_000) {
      setFileError("File is larger than 2 MB. Trim it down.");
      return;
    }
    const isXlsx = XLSX_EXTENSIONS.test(file.name);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        if (isXlsx) {
          const { xlsxFileToCsv } = await import("@/lib/xlsx-metrics");
          const buf = reader.result as ArrayBuffer;
          const { csv, sheetName, totalSheets } = xlsxFileToCsv(buf);
          handleText(csv);
          if (totalSheets > 1) {
            setFileError(`Imported sheet "${sheetName}" — workbook has ${totalSheets} sheets, others were ignored.`);
          }
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

  const canImport = parsed && parsed.rows.length > 0 && parsed.errors.length === 0;

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
              One row per company. Headers are matched flexibly — paste your Airtable export.
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
              <div className="text-[11px] text-muted mt-0.5">Max 2 MB · first sheet of the workbook</div>
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

          {parsed && <PreviewBlock parsed={parsed} />}

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
            onClick={() => parsed && onImport(parsed.rows.map(stripLine))}
            disabled={!canImport}
          >
            {parsed && parsed.rows.length > 0
              ? `Add ${parsed.rows.length} compan${parsed.rows.length === 1 ? "y" : "ies"}`
              : "Import"}
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

function PreviewBlock({ parsed }: { parsed: ReturnType<typeof parseCompaniesCsv> }) {
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
