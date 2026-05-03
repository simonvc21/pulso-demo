"use client";

import { useState, useTransition, useRef } from "react";
import { createPortal } from "react-dom";
import { Upload, FileText, X, Check, AlertTriangle, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseLpsCsv } from "@/lib/csv-lps";
import { bulkImportLps } from "@/app/(gp)/lps/actions";

const XLSX_EXTENSIONS = /\.(xlsx|xlsm|xls|xlsb|ods)$/i;

type CommitResult = { inserted: number; skipped: number; errors: string[] };

const SAMPLE_CSV = [
  "name,type,commitment_usd,country,email",
  "Andina Family Office,Family Office,5000000,CL,contact@andina.cl",
  "LATAM Pension Fund,Institutional,15000000,BR,investments@latampension.com.br",
  "Vega Capital,Fund of Funds,3000000,US,team@vega.vc",
  "Marcos Pereira,Individual,500K,MX,marcos@gmail.com",
].join("\n");

interface Props {
  buttonLabel?: string;
}

export function LpsCsvImport({ buttonLabel = "Import LPs" }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Upload className="h-3.5 w-3.5" /> {buttonLabel}
      </Button>
      {open && <ImportModal onClose={() => setOpen(false)} />}
    </>
  );
}

function ImportModal({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ReturnType<typeof parseLpsCsv> | null>(null);
  const [committing, startTransition] = useTransition();
  const [result, setResult] = useState<CommitResult | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleText = (val: string) => {
    setText(val);
    setResult(null);
    setServerError(null);
    setParsed(val.trim() ? parseLpsCsv(val) : null);
  };

  const handleFile = (file: File) => {
    if (file.size > 2_000_000) {
      setServerError("File is larger than 2 MB. Trim it down or split into multiple uploads.");
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
            setServerError(`Imported sheet "${sheetName}" — workbook has ${totalSheets} sheets, others ignored.`);
          }
        } else {
          const txt = typeof reader.result === "string" ? reader.result : "";
          handleText(txt);
        }
      } catch (err: any) {
        setServerError(err?.message ?? "Could not read file");
      }
    };
    reader.onerror = () => setServerError("File read failed");
    if (isXlsx) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  };

  const commit = () => {
    if (!parsed || parsed.rows.length === 0) return;
    setServerError(null);
    startTransition(async () => {
      const rows = parsed.rows.map((r) => ({
        name: r.name,
        type: r.type,
        commitmentUsd: r.commitmentUsd,
        country: r.country,
        email: r.email,
        lineNumber: r.lineNumber,
      }));
      const res = await bulkImportLps(rows);
      if (!res.ok) { setServerError(res.error); return; }
      setResult({ inserted: res.inserted, skipped: res.skipped, errors: res.errors });
    });
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pulso-lps-template.csv";
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
            <h2 className="text-base font-semibold text-ink">Import LPs from CSV / Excel</h2>
            <p className="text-[11px] text-muted mt-0.5">
              Adds new LPs to your fund. Existing LPs aren't deduped — re-uploading the same file twice will create doubles.
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
              <div className="mt-2 text-sm font-medium text-ink">Upload .csv or .xlsx</div>
              <div className="text-[11px] text-muted mt-0.5">Max 2 MB</div>
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
              <div className="text-[11px] text-muted mt-0.5">name + type + commitment + country + email</div>
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
              placeholder="name,type,commitment_usd,country,email"
              className="w-full px-3 py-2 rounded-lg border border-line text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal/30"
            />
          </div>

          {parsed && <PreviewBlock parsed={parsed} />}

          {serverError && (
            <div className="rounded-lg border border-coral/40 bg-coral/10 px-3 py-2 text-xs text-coral">{serverError}</div>
          )}

          {result && (
            <div className="rounded-xl border border-teal/40 bg-teal/5 px-4 py-3 text-sm">
              <div className="flex items-center gap-2 text-teal-600 font-semibold">
                <Check className="h-4 w-4" /> Import complete
              </div>
              <div className="mt-1 text-[12px] text-ink">
                <span className="font-semibold">{result.inserted}</span> LP{result.inserted === 1 ? "" : "s"} added ·{" "}
                <span className="font-semibold">{result.skipped}</span> skipped
              </div>
              {result.errors.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-coral text-[11px]">
                    {result.errors.length} skipped row{result.errors.length === 1 ? "" : "s"} — see why
                  </summary>
                  <ul className="mt-1 text-[11px] text-coral list-disc pl-4 space-y-0.5">
                    {result.errors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </details>
              )}
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
                ? `Import ${parsed.rows.length} LP${parsed.rows.length === 1 ? "" : "s"}`
                : "Import"}
            </Button>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function PreviewBlock({ parsed }: { parsed: ReturnType<typeof parseLpsCsv> }) {
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
                <th className="px-2 py-1.5 font-semibold">Type</th>
                <th className="px-2 py-1.5 font-semibold text-right">Commitment</th>
                <th className="px-2 py-1.5 font-semibold">Country</th>
                <th className="px-2 py-1.5 font-semibold">Email</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y divide-line", hasErrors && "opacity-60")}>
              {parsed.rows.slice(0, 60).map((r, i) => (
                <tr key={i} className="text-ink">
                  <td className="px-2 py-1 font-medium">{r.name}</td>
                  <td className="px-2 py-1">{r.type}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{r.commitmentUsd?.toLocaleString() ?? "—"}</td>
                  <td className="px-2 py-1">{r.country ?? "—"}</td>
                  <td className="px-2 py-1 truncate max-w-[200px]">{r.email ?? "—"}</td>
                </tr>
              ))}
              {parsed.rows.length > 60 && (
                <tr className="text-muted text-[10px]">
                  <td colSpan={5} className="px-2 py-1 italic">… and {parsed.rows.length - 60} more rows</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
