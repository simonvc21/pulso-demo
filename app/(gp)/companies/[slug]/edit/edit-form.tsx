"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateCompany, type CompanyInput } from "../../actions";

const stages = ["Pre-seed", "Seed", "Series A", "Series B"] as const;
const statuses = [
  { value: "healthy", label: "Healthy" },
  { value: "watch", label: "Watch" },
  { value: "critical", label: "Critical" },
  { value: "no_data", label: "No data" },
] as const;
const instruments = [
  { value: "", label: "—" },
  { value: "safe", label: "SAFE" },
  { value: "convertible_note", label: "Convertible Note" },
  { value: "equity", label: "Equity" },
  { value: "saft", label: "SAFT" },
  { value: "warrant", label: "Warrant" },
  { value: "loan", label: "Loan" },
  { value: "other", label: "Other" },
] as const;

const INSTRUMENTS_WITH_CAP = new Set(["safe", "convertible_note"]);

const cadences = [
  { value: "monthly",   label: "Monthly",   hint: "Founder reports every month — fintech, SaaS, marketplaces" },
  { value: "quarterly", label: "Quarterly", hint: "Standard VC quarterly cycle — most early-stage" },
  { value: "annual",    label: "Annual",    hint: "Late-stage / hold positions" },
] as const;

interface Props {
  slug: string;
  initial: CompanyInput;
}

export function CompanyEditForm({ slug, initial }: Props) {
  const router = useRouter();
  const [v, setV] = useState<CompanyInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const update = <K extends keyof CompanyInput>(k: K, val: CompanyInput[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  const updateFounder = <K extends keyof CompanyInput["founder"]>(k: K, val: CompanyInput["founder"][K]) =>
    setV((prev) => ({ ...prev, founder: { ...prev.founder, [k]: val } }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await updateCompany(slug, v);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSavedAt(Date.now());
      router.push(`/companies/${slug}`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
      <Section title="Identity">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Name" value={v.name} onChange={(s) => update("name", s)} required />
          <Input label="Sector" value={v.sector ?? ""} onChange={(s) => update("sector", s || null)} placeholder="Fintech" />
          <Input label="Country (ISO)" value={v.country ?? ""} onChange={(s) => update("country", s.toUpperCase() || null)} maxLength={2} placeholder="MX" />
          <Select label="Stage" value={v.stage} onChange={(s) => update("stage", s as typeof v.stage)} options={stages.map((s) => ({ value: s, label: s }))} />
          <Select label="Status" value={v.status} onChange={(s) => update("status", s as typeof v.status)} options={statuses.map((s) => ({ value: s.value, label: s.label }))} />
          <Input label="Flag (short alert)" value={v.flag ?? ""} onChange={(s) => update("flag", s || null)} placeholder="Runway < 9 mo" />
        </div>
        <div className="mt-3">
          <Textarea label="Description" value={v.description ?? ""} onChange={(s) => update("description", s || null)} rows={2} />
        </div>
      </Section>

      <Section title="Investment">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            label="Invested (USD)"
            type="number"
            value={String(v.investedUsd)}
            onChange={(s) => update("investedUsd", parseFloat(s) || 0)}
          />
          <Input
            label="Ownership (%)"
            type="number"
            step="0.1"
            value={String(v.ownershipPct)}
            onChange={(s) => update("ownershipPct", parseFloat(s) || 0)}
          />
          <Select
            label="Instrument"
            value={v.investmentInstrument ?? ""}
            onChange={(s) => {
              const next = (s || null) as CompanyInput["investmentInstrument"];
              update("investmentInstrument", next);
              if (!next || !INSTRUMENTS_WITH_CAP.has(next)) {
                update("safeCapUsd", null);
                update("safeDiscountPct", null);
              }
            }}
            options={instruments.map((i) => ({ value: i.value, label: i.label }))}
          />
          {v.investmentInstrument && INSTRUMENTS_WITH_CAP.has(v.investmentInstrument) && (
            <>
              <Input
                label="Cap (USD)"
                type="number"
                value={v.safeCapUsd != null ? String(v.safeCapUsd) : ""}
                onChange={(s) => update("safeCapUsd", s.trim() === "" ? null : parseFloat(s) || 0)}
                placeholder="10000000"
              />
              <Input
                label="Discount (%)"
                type="number"
                step="0.5"
                value={v.safeDiscountPct != null ? String(v.safeDiscountPct) : ""}
                onChange={(s) => update("safeDiscountPct", s.trim() === "" ? null : parseFloat(s) || 0)}
                placeholder="20"
              />
            </>
          )}
        </div>
      </Section>

      <Section title="Reporting cadence">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {cadences.map((c) => {
            const active = v.trackingCadence === c.value;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => update("trackingCadence", c.value as typeof v.trackingCadence)}
                className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
                  active ? "border-navy bg-navy/5 text-navy" : "border-line text-muted hover:border-navy/40 hover:text-ink"
                }`}
              >
                <div className="text-sm font-semibold">{c.label}</div>
                <div className="text-[10px] mt-0.5 leading-tight">{c.hint}</div>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-muted mt-2">
          Founders submit metrics at this cadence. Charts and the /data spreadsheet adapt accordingly.
        </p>
      </Section>

      <Section title="Founder">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input label="Name" value={v.founder.name ?? ""} onChange={(s) => updateFounder("name", s || null)} />
          <Input label="Email" type="email" value={v.founder.email ?? ""} onChange={(s) => updateFounder("email", s || null)} />
          <Input label="Role" value={v.founder.role ?? ""} onChange={(s) => updateFounder("role", s || null)} placeholder="CEO" />
        </div>
      </Section>

      <Section title="Links">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            label="Website"
            type="url"
            value={v.website ?? ""}
            onChange={(s) => update("website", s || null)}
            placeholder="https://acme.io"
          />
          <Input
            label="LinkedIn"
            type="url"
            value={v.linkedinUrl ?? ""}
            onChange={(s) => update("linkedinUrl", s || null)}
            placeholder="https://www.linkedin.com/company/acme"
          />
        </div>
      </Section>

      {error && (
        <div className="text-[12px] text-coral bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        {savedAt ? (
          <span className="text-[11px] text-teal-600 inline-flex items-center gap-1.5">
            <Check className="h-3 w-3" /> Saved
          </span>
        ) : <span />}
        <Button type="submit" variant="gold" size="md" className="gap-1.5" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-line shadow-card p-5">
      <h3 className="text-[10px] tracking-[0.16em] uppercase text-muted font-semibold mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Input({
  label, value, onChange, type = "text", placeholder, required, maxLength, step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  step?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-semibold text-muted tracking-[0.14em] uppercase mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        step={step}
        className="w-full h-10 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 tabular-nums"
      />
    </label>
  );
}

function Select({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-semibold text-muted tracking-[0.14em] uppercase mb-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function Textarea({
  label, value, onChange, rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-semibold text-muted tracking-[0.14em] uppercase mb-1">{label}</span>
      <textarea
        rows={rows ?? 3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
      />
    </label>
  );
}
