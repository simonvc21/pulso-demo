"use client";

import { useMemo, useState } from "react";
import { Sparkles, Upload, Check, ChevronRight, ArrowLeft, Zap, FileText, Lock, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PublicFormPayload, FormFieldRow } from "@/lib/dashboard-data";
import { submitFillForm } from "./actions";

type Mode = "intro" | "upload" | "form" | "review" | "done";

function guessAiValue(field: FormFieldRow): string {
  const l = field.label.toLowerCase();
  if (field.type === "currency") {
    if (l.includes("cash")) return "6000000";
    if (l.includes("burn")) return "620000";
    if (l.includes("arr") || l.includes("recurring")) return "12300000";
    if (l.includes("revenue")) return "3000000";
    return "1000000";
  }
  if (field.type === "number") return "62";
  if (field.type === "percent") return "68";
  return "";
}

function groupFields(fields: FormFieldRow[]): { title: string; fields: FormFieldRow[] }[] {
  const groups = new Map<string, FormFieldRow[]>();
  for (const f of fields) {
    const key = f.group ?? "General";
    const arr = groups.get(key) ?? [];
    arr.push(f);
    groups.set(key, arr);
  }
  return Array.from(groups.entries()).map(([title, fs]) => ({ title, fields: fs }));
}

export default function FillForm({ payload }: { payload: PublicFormPayload }) {
  const { form, company, organization } = payload;
  const sections = useMemo(() => groupFields(form.fields), [form.fields]);
  const totalFields = form.fields.length;

  const [mode, setMode] = useState<Mode>("intro");
  const [values, setValues] = useState<Record<string, string>>({});
  const [aiFilled, setAiFilled] = useState<Record<string, boolean>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const filledCount = Object.values(values).filter(Boolean).length;
  const progress = totalFields ? (filledCount / totalFields) * 100 : 0;

  const fakeUploadComplete = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const next: Record<string, string> = {};
      const flag: Record<string, boolean> = {};
      for (const f of form.fields) {
        const v = guessAiValue(f);
        if (v) {
          next[f.id] = v;
          flag[f.id] = true;
        }
      }
      setValues(next);
      setAiFilled(flag);
      setIsProcessing(false);
      setMode("form");
    }, 1500);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    const aiUsed = Object.keys(aiFilled).length > 0;
    const res = await submitFillForm({
      formSlug: form.slug,
      companySlug: company.slug,
      data: values,
      aiExtracted: aiUsed,
    });
    setSubmitting(false);
    if (!res.ok) {
      setSubmitError(res.error);
      return;
    }
    setMode("done");
  };

  const founderFirst = (company.founder_name ?? "").split(" ")[0] || "there";

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-white border-b border-line">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-full bg-gold flex items-center justify-center">
              <Zap className="h-3.5 w-3.5 text-navy" fill="currentColor" />
            </div>
            <div>
              <div className="text-[10px] tracking-[0.16em] font-semibold text-ink">PULSO</div>
              <div className="text-[10px] text-muted">on behalf of {organization.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted">
            <Lock className="h-3 w-3" /> End-to-end encrypted
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {mode === "intro" && (
          <IntroStage
            founderFirst={founderFirst}
            companyName={company.name}
            orgName={organization.name}
            formName={form.name}
            onPickFresh={() => setMode("form")}
            onPickAI={() => setMode("upload")}
          />
        )}

        {mode === "upload" && (
          <UploadStage onUploadComplete={fakeUploadComplete} isProcessing={isProcessing} />
        )}

        {mode === "form" && (
          <FormStage
            sections={sections}
            values={values}
            setValues={setValues}
            aiFilled={aiFilled}
            progress={progress}
            filledCount={filledCount}
            total={totalFields}
            formName={form.name}
            orgName={organization.name}
            onSubmit={() => setMode("review")}
            onBack={() => setMode("intro")}
          />
        )}

        {mode === "review" && (
          <ReviewStage
            onSubmit={handleSubmit}
            onBack={() => setMode("form")}
            orgName={organization.name}
            submitting={submitting}
            error={submitError}
          />
        )}

        {mode === "done" && <DoneStage founderFirst={founderFirst} orgName={organization.name} />}
      </div>
    </div>
  );
}

function IntroStage({
  founderFirst, companyName, orgName, formName, onPickFresh, onPickAI,
}: {
  founderFirst: string;
  companyName: string;
  orgName: string;
  formName: string;
  onPickFresh: () => void;
  onPickAI: () => void;
}) {
  return (
    <div className="animate-fade-in">
      <div className="text-[11px] font-semibold text-gold-600 tracking-[0.18em] uppercase">{formName}</div>
      <h1 className="mt-2 text-3xl font-serif font-bold text-ink leading-tight">
        Hi {founderFirst} — {orgName} needs {companyName}'s numbers.
      </h1>
      <p className="mt-3 text-sm text-muted">
        This usually takes 5–8 minutes. Pulso saves your progress automatically. You can also upload your investor deck, P&L, or financial PDF and Pulso will fill out most of this form for you.
      </p>

      <div className="mt-7 grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={onPickAI}
          className="group text-left bg-white rounded-xl border-2 border-teal-50 hover:border-teal hover:shadow-cardHover transition-all p-5"
        >
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-lg bg-teal-50 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-teal-600" />
            </div>
            <div className="text-[10px] text-teal-600 font-semibold tracking-[0.14em] uppercase">Recommended</div>
          </div>
          <h3 className="mt-3 text-base font-serif font-semibold text-ink">Upload a PDF or Excel</h3>
          <p className="mt-1 text-[12px] text-muted">Pulso AI extracts your numbers and pre-fills the form. You confirm and submit.</p>
          <div className="mt-3 text-[11px] text-teal-600 font-medium inline-flex items-center gap-1">Start with AI <ChevronRight className="h-3.5 w-3.5" /></div>
        </button>

        <button
          onClick={onPickFresh}
          className="group text-left bg-white rounded-xl border border-line hover:shadow-card transition-all p-5"
        >
          <div className="h-10 w-10 rounded-lg bg-paper2 flex items-center justify-center">
            <FileText className="h-5 w-5 text-navy" />
          </div>
          <h3 className="mt-3 text-base font-serif font-semibold text-ink">Fill it out manually</h3>
          <p className="mt-1 text-[12px] text-muted">Type each value yourself. Pulso saves your progress automatically.</p>
          <div className="mt-3 text-[11px] text-navy font-medium inline-flex items-center gap-1">Start blank <ChevronRight className="h-3.5 w-3.5" /></div>
        </button>
      </div>

      <div className="mt-8 flex items-center gap-2 text-[11px] text-muted">
        <Clock className="h-3 w-3" /> Auto-saved · responses go straight to {orgName}
      </div>
    </div>
  );
}

function UploadStage({
  onUploadComplete, isProcessing,
}: { onUploadComplete: () => void; isProcessing: boolean }) {
  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-serif font-bold text-ink">Upload your financial document</h1>
      <p className="mt-1 text-sm text-muted">PDF, Excel, or screenshot. Pulso extracts the numbers and fills the form.</p>

      <div
        onClick={isProcessing ? undefined : onUploadComplete}
        className={cn(
          "mt-6 bg-white rounded-xl border-2 border-dashed p-12 text-center cursor-pointer transition-all",
          isProcessing ? "border-teal bg-teal-50 cursor-default" : "border-line hover:border-teal hover:bg-teal-50"
        )}
      >
        {isProcessing ? (
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-teal-50 flex items-center justify-center relative">
              <Sparkles className="h-6 w-6 text-teal-600 animate-pulse" />
              <span className="absolute inset-0 rounded-full ring-2 ring-teal/30 animate-ping" />
            </div>
            <div className="text-sm font-semibold text-ink">Pulso AI is extracting your financials…</div>
            <div className="text-[12px] text-muted">Reading P&L · cross-checking with last quarter · validating outliers</div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-paper2 flex items-center justify-center">
              <Upload className="h-5 w-5 text-navy" />
            </div>
            <div className="text-sm font-semibold text-ink">Drop your file here, or click to browse</div>
            <div className="text-[11px] text-muted">PDF · Excel · CSV · Screenshot — up to 25 MB</div>
            <div className="mt-2 text-[11px] text-muted">
              Or connect <a className="text-teal-600 hover:underline">QuickBooks</a> · <a className="text-teal-600 hover:underline">Contabilizei</a> · <a className="text-teal-600 hover:underline">Xero</a>
            </div>
          </div>
        )}
      </div>

      {!isProcessing && (
        <div className="mt-3 text-[11px] text-muted">
          Demo tip: clicking the upload area simulates Pulso AI extracting the numbers.
        </div>
      )}
    </div>
  );
}

function FormStage({
  sections, values, setValues, aiFilled, progress, filledCount, total, formName, orgName, onSubmit, onBack,
}: {
  sections: { title: string; fields: FormFieldRow[] }[];
  values: Record<string, string>;
  setValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  aiFilled: Record<string, boolean>;
  progress: number;
  filledCount: number;
  total: number;
  formName: string;
  orgName: string;
  onSubmit: () => void;
  onBack: () => void;
}) {
  return (
    <div className="animate-fade-in">
      <button onClick={onBack} className="text-[12px] text-muted hover:text-ink inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3 w-3" /> Back
      </button>

      <div className="bg-white rounded-xl border border-line shadow-card overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-line">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-serif font-bold text-ink">{formName}</h2>
              <p className="text-[11px] text-muted mt-0.5">{filledCount} of {total} fields complete</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted">Auto-saved</div>
              <div className="text-[11px] text-teal-600 font-medium">just now</div>
            </div>
          </div>
          <div className="mt-3 h-1.5 bg-paper2 rounded-full overflow-hidden">
            <div className="h-full bg-teal transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="px-6 py-5 space-y-7">
          {sections.map((sec) => (
            <div key={sec.title}>
              <div className="text-[10px] font-semibold text-gold-600 tracking-[0.16em] uppercase">{sec.title}</div>
              <div className="mt-3 space-y-3.5">
                {sec.fields.map((f) => (
                  <FieldInput
                    key={f.id}
                    field={f}
                    value={values[f.id] || ""}
                    isAi={!!aiFilled[f.id]}
                    onChange={(v) => setValues((p) => ({ ...p, [f.id]: v }))}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 bg-paper border-t border-line flex items-center justify-between">
          <div className="text-[11px] text-muted">
            <Lock className="h-3 w-3 inline mr-1" /> Only {orgName} can see your responses.
          </div>
          <Button variant="primary" size="md" onClick={onSubmit} disabled={filledCount === 0} className="gap-1.5">
            Review & submit <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function FieldInput({
  field, value, isAi, onChange,
}: {
  field: FormFieldRow;
  value: string;
  isAi: boolean;
  onChange: (v: string) => void;
}) {
  const baseInput = cn(
    "h-10 flex-1 px-3 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 tabular-nums",
    isAi ? "border-teal bg-teal-50/40" : "border-line"
  );

  return (
    <div>
      <label className="text-[12px] font-medium text-ink flex items-center gap-1.5">
        {field.label}
        {field.required && <span className="text-[10px] text-coral font-semibold">·</span>}
        {isAi && (
          <span className="inline-flex items-center gap-1 text-[10px] text-teal-600 font-semibold bg-teal-50 px-1.5 py-0.5 rounded">
            <Sparkles className="h-2.5 w-2.5" /> AI-filled · review
          </span>
        )}
      </label>
      <div className="mt-1">
        {field.type === "longtext" ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            placeholder="Type your response…"
            className="w-full px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
          />
        ) : field.type === "select" ? (
          <select value={value} onChange={(e) => onChange(e.target.value)} className={baseInput}>
            <option value="">Select…</option>
            {(field.options ?? []).map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        ) : field.type === "date" ? (
          <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={baseInput} />
        ) : (
          <div className="flex items-center gap-2">
            {field.type === "currency" && <span className="text-xs text-muted bg-paper2 px-2 py-2 rounded-lg">$</span>}
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.type === "currency" ? "0.00" : field.type === "percent" ? "0" : ""}
              className={baseInput}
            />
            {field.type === "percent" && <span className="text-xs text-muted">%</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewStage({
  onSubmit, onBack, orgName, submitting, error,
}: {
  onSubmit: () => void;
  onBack: () => void;
  orgName: string;
  submitting: boolean;
  error: string | null;
}) {
  return (
    <div className="animate-fade-in">
      <button onClick={onBack} className="text-[12px] text-muted hover:text-ink inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3 w-3" /> Back
      </button>
      <h1 className="text-2xl font-serif font-bold text-ink">Review your submission</h1>
      <p className="text-sm text-muted mt-1">Pulso AI flagged these for your attention before submission.</p>

      <div className="mt-5 bg-white rounded-xl border border-line shadow-card divide-y divide-line">
        <div className="px-5 py-4 flex items-start gap-3">
          <div className="h-7 w-7 rounded-full bg-teal-50 flex items-center justify-center shrink-0">
            <Sparkles className="h-3.5 w-3.5 text-teal-600" />
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-ink">Numbers look consistent with your last quarter.</div>
            <div className="text-[11px] text-muted mt-0.5">No anomalies detected.</div>
          </div>
          <Check className="h-5 w-5 text-teal-600 shrink-0" />
        </div>
        <div className="px-5 py-4 flex items-start gap-3">
          <div className="h-7 w-7 rounded-full bg-gold-50 flex items-center justify-center shrink-0">
            <Sparkles className="h-3.5 w-3.5 text-gold-600" />
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-ink">Add quick context in the narrative section?</div>
            <div className="text-[11px] text-muted mt-0.5">Your GP can ask better questions when you flag the why.</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 text-[12px] text-coral bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-muted hover:text-ink">Edit submission</button>
        <Button variant="gold" size="md" onClick={onSubmit} disabled={submitting} className="gap-2">
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
            </>
          ) : (
            <>
              Submit to {orgName} <ChevronRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function DoneStage({ founderFirst, orgName }: { founderFirst: string; orgName: string }) {
  return (
    <div className="animate-fade-in text-center py-16">
      <div className="h-16 w-16 rounded-full bg-teal-50 flex items-center justify-center mx-auto">
        <Check className="h-8 w-8 text-teal-600" strokeWidth={3} />
      </div>
      <h1 className="mt-5 text-2xl font-serif font-bold text-ink">Submitted. Thank you, {founderFirst}.</h1>
      <p className="mt-2 text-sm text-muted max-w-md mx-auto">
        {orgName} has been notified. They typically respond within 48 hours if they have follow-up questions.
      </p>
    </div>
  );
}
