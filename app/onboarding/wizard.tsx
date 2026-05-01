"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Zap, Building2, Users, Send, Check, ChevronRight, ChevronLeft, Loader2,
  Plus, Trash2, ArrowRight, Sparkles, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createFund, importCompanies, finishOnboarding, type CompanyDraft } from "./actions";
import { inviteUser } from "../(gp)/settings/team-actions";

type Step = 1 | 2 | 3;

interface Props {
  userEmail: string;
  userName: string | null;
}

export function OnboardingWizard({ userEmail, userName }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Step 1: fund
  const [fundName, setFundName] = useState("");
  const [vintage, setVintage] = useState(String(new Date().getFullYear()));
  const [sizeUsd, setSizeUsd] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [fundCreated, setFundCreated] = useState(false);

  // Step 2: companies
  const [companies, setCompanies] = useState<CompanyDraft[]>([
    emptyCompany(),
  ]);
  const [companiesImported, setCompaniesImported] = useState(0);

  // Step 3: invitations
  const [invites, setInvites] = useState<{ email: string; role: "analyst" | "managing_partner" | "viewer" }[]>([
    { email: "", role: "analyst" },
  ]);
  const [invitesResults, setInvitesResults] = useState<Array<{ email: string; ok: boolean; error?: string }>>([]);

  const submitStep1 = () => {
    if (!fundName.trim()) {
      setError("Fund name is required");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await createFund({
        name: fundName,
        vintage: vintage ? parseInt(vintage, 10) : null,
        sizeUsd: sizeUsd ? parseFloat(sizeUsd) : null,
        currency,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setFundCreated(true);
      setStep(2);
    });
  };

  const submitStep2 = () => {
    setError(null);
    const valid = companies.filter((c) => c.name.trim().length > 0);
    if (valid.length === 0) {
      // Allow skipping with no companies — they can add later.
      setStep(3);
      return;
    }
    startTransition(async () => {
      const res = await importCompanies(valid);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCompaniesImported(res.inserted);
      setStep(3);
    });
  };

  const submitStep3 = () => {
    setError(null);
    const valid = invites.filter((i) => i.email.trim().length > 0);
    if (valid.length === 0) {
      startTransition(async () => {
        await finishOnboarding();
      });
      return;
    }
    startTransition(async () => {
      const results: typeof invitesResults = [];
      for (const inv of valid) {
        const res = await inviteUser({ email: inv.email, role: inv.role });
        results.push({ email: inv.email, ok: res.ok, error: res.ok ? undefined : res.error });
      }
      setInvitesResults(results);
      // Stay on the page for ~1.2s so the user sees the confirmations, then finish.
      setTimeout(() => {
        startTransition(async () => {
          await finishOnboarding();
        });
      }, 1200);
    });
  };

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy text-white border-b border-white/5">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="h-7 w-7 rounded-full bg-gold flex items-center justify-center">
            <Zap className="h-3.5 w-3.5 text-navy" fill="currentColor" />
          </div>
          <div>
            <div className="text-[11px] tracking-[0.18em] font-semibold">PULSO · ONBOARDING</div>
            <div className="text-[10px] text-white/60">{userName ?? userEmail}</div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <Stepper step={step} />

        {error && (
          <div className="mb-4 text-[12px] text-coral bg-red-50 border border-red-100 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {step === 1 && (
          <Step1
            name={fundName} setName={setFundName}
            vintage={vintage} setVintage={setVintage}
            sizeUsd={sizeUsd} setSizeUsd={setSizeUsd}
            currency={currency} setCurrency={setCurrency}
            onNext={submitStep1}
            pending={pending}
          />
        )}

        {step === 2 && (
          <Step2
            companies={companies}
            setCompanies={setCompanies}
            onBack={() => setStep(1)}
            onNext={submitStep2}
            pending={pending}
          />
        )}

        {step === 3 && (
          <Step3
            invites={invites}
            setInvites={setInvites}
            results={invitesResults}
            companiesImported={companiesImported}
            onBack={() => setStep(2)}
            onFinish={submitStep3}
            pending={pending}
          />
        )}
      </div>
    </div>
  );
}

function emptyCompany(): CompanyDraft {
  return {
    name: "",
    sector: "",
    country: "",
    stage: "Seed",
    status: "no_data",
    investedUsd: 0,
    ownershipPct: 0,
    founderName: "",
    founderEmail: "",
  };
}

function Stepper({ step }: { step: Step }) {
  const items = [
    { n: 1, label: "Your fund", icon: Building2 },
    { n: 2, label: "Portfolio", icon: FileText },
    { n: 3, label: "Invite team", icon: Users },
  ];
  return (
    <div className="mb-8 flex items-center gap-3">
      {items.map((it, i) => {
        const Icon = it.icon;
        const active = step === it.n;
        const done = step > it.n;
        return (
          <div key={it.n} className="flex items-center gap-3 flex-1 last:flex-none">
            <div className={cn(
              "h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 border-2",
              active ? "bg-navy text-gold border-navy"
              : done ? "bg-teal text-white border-teal"
              : "bg-white text-muted border-line"
            )}>
              {done ? <Check className="h-4 w-4" /> : it.n}
            </div>
            <div className="hidden sm:block">
              <div className={cn("text-[10px] tracking-[0.14em] uppercase font-semibold", active ? "text-gold-600" : done ? "text-teal-600" : "text-muted")}>
                Step {it.n}
              </div>
              <div className={cn("text-sm font-medium", active ? "text-ink" : done ? "text-ink" : "text-muted")}>
                {it.label}
              </div>
            </div>
            {i < items.length - 1 && (
              <div className={cn("hidden sm:block flex-1 h-px", done ? "bg-teal" : "bg-line")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: fund profile
// ---------------------------------------------------------------------------

function Step1({
  name, setName, vintage, setVintage, sizeUsd, setSizeUsd, currency, setCurrency, onNext, pending,
}: {
  name: string; setName: (v: string) => void;
  vintage: string; setVintage: (v: string) => void;
  sizeUsd: string; setSizeUsd: (v: string) => void;
  currency: string; setCurrency: (v: string) => void;
  onNext: () => void; pending: boolean;
}) {
  return (
    <Card>
      <h1 className="text-2xl font-serif font-bold text-ink">Tell us about your fund</h1>
      <p className="mt-1 text-sm text-muted">You can edit any of this later in Settings.</p>

      <form
        onSubmit={(e) => { e.preventDefault(); onNext(); }}
        className="mt-6 space-y-4"
      >
        <Field label="Fund name">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Patagonia Fund I"
            className="w-full h-11 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
          />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Vintage">
            <input
              type="number"
              value={vintage}
              onChange={(e) => setVintage(e.target.value)}
              placeholder="2024"
              className="w-full h-11 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 tabular-nums"
            />
          </Field>
          <Field label="Fund size (USD)">
            <input
              type="number"
              min="0"
              value={sizeUsd}
              onChange={(e) => setSizeUsd(e.target.value)}
              placeholder="80000000"
              className="w-full h-11 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 tabular-nums"
            />
          </Field>
          <Field label="Currency">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
            >
              <option>USD</option>
              <option>BRL</option>
              <option>MXN</option>
              <option>CLP</option>
              <option>ARS</option>
              <option>COP</option>
              <option>PEN</option>
            </select>
          </Field>
        </div>

        <div className="pt-3 flex justify-end">
          <Button type="submit" variant="gold" size="md" className="gap-1.5" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
            {pending ? "Creating…" : "Continue"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Step 2: companies
// ---------------------------------------------------------------------------

function Step2({
  companies, setCompanies, onBack, onNext, pending,
}: {
  companies: CompanyDraft[];
  setCompanies: React.Dispatch<React.SetStateAction<CompanyDraft[]>>;
  onBack: () => void; onNext: () => void; pending: boolean;
}) {
  const update = (i: number, patch: Partial<CompanyDraft>) =>
    setCompanies((p) => p.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const remove = (i: number) =>
    setCompanies((p) => p.filter((_, idx) => idx !== i));
  const add = () => setCompanies((p) => [...p, emptyCompany()]);

  return (
    <Card>
      <h1 className="text-2xl font-serif font-bold text-ink">Add your portfolio companies</h1>
      <p className="mt-1 text-sm text-muted">
        One row per company. Skip if you'll add them later — you can always import a CSV from the dashboard.
      </p>

      <div className="mt-5 space-y-3">
        {companies.map((c, i) => (
          <div key={i} className="bg-paper rounded-xl border border-line p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] font-semibold text-muted tracking-[0.14em] uppercase">
                Company {i + 1}
              </div>
              {companies.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-muted hover:text-coral text-[11px] inline-flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <CellInput label="Name" required value={c.name} onChange={(v) => update(i, { name: v })} />
              <CellInput label="Sector" value={c.sector ?? ""} onChange={(v) => update(i, { sector: v || null })} placeholder="Fintech" />
              <CellInput label="Country" value={c.country ?? ""} onChange={(v) => update(i, { country: v.toUpperCase() })} maxLength={2} placeholder="MX" />
              <CellSelect label="Stage" value={c.stage} onChange={(v) => update(i, { stage: v as any })} options={["Pre-seed","Seed","Series A","Series B"]} />
              <CellInput label="Invested (USD)" type="number" value={String(c.investedUsd || "")} onChange={(v) => update(i, { investedUsd: parseFloat(v) || 0 })} />
              <CellInput label="Ownership %" type="number" step="0.1" value={String(c.ownershipPct || "")} onChange={(v) => update(i, { ownershipPct: parseFloat(v) || 0 })} />
              <CellInput label="Founder" value={c.founderName ?? ""} onChange={(v) => update(i, { founderName: v || null })} />
              <CellInput label="Founder email" type="email" value={c.founderEmail ?? ""} onChange={(v) => update(i, { founderEmail: v || null })} />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={add}
          className="w-full bg-paper2 border-2 border-dashed border-line hover:border-navy rounded-xl px-5 py-4 text-[13px] text-muted hover:text-navy inline-flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add another company
        </button>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={onBack} disabled={pending} className="gap-1.5">
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </Button>
        <Button type="button" variant="gold" size="md" className="gap-1.5" onClick={onNext} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
          {pending ? "Saving…" : companies.some((c) => c.name.trim()) ? "Import & continue" : "Skip for now"}
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Step 3: invitations
// ---------------------------------------------------------------------------

function Step3({
  invites, setInvites, results, companiesImported, onBack, onFinish, pending,
}: {
  invites: { email: string; role: "analyst" | "managing_partner" | "viewer" }[];
  setInvites: React.Dispatch<React.SetStateAction<{ email: string; role: "analyst" | "managing_partner" | "viewer" }[]>>;
  results: Array<{ email: string; ok: boolean; error?: string }>;
  companiesImported: number;
  onBack: () => void;
  onFinish: () => void;
  pending: boolean;
}) {
  const update = (i: number, patch: Partial<{ email: string; role: "analyst" | "managing_partner" | "viewer" }>) =>
    setInvites((p) => p.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const remove = (i: number) => setInvites((p) => p.filter((_, idx) => idx !== i));
  const add = () => setInvites((p) => [...p, { email: "", role: "analyst" }]);

  return (
    <Card>
      <h1 className="text-2xl font-serif font-bold text-ink">Invite your team</h1>
      <p className="mt-1 text-sm text-muted">
        {companiesImported > 0
          ? `${companiesImported} companies imported. Now invite your partners and analysts to join.`
          : "Invite your partners and analysts to join. They'll be added when they sign in."}
      </p>

      <div className="mt-5 space-y-2">
        {invites.map((inv, i) => {
          const result = results.find((r) => r.email.toLowerCase() === inv.email.trim().toLowerCase());
          return (
            <div key={i} className="bg-paper rounded-xl border border-line p-3 flex items-center gap-2">
              <input
                type="email"
                value={inv.email}
                onChange={(e) => update(i, { email: e.target.value })}
                placeholder="analyst@fund.com"
                className="flex-1 h-10 px-3 rounded-lg border border-line text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal/30"
              />
              <select
                value={inv.role}
                onChange={(e) => update(i, { role: e.target.value as any })}
                className="h-10 px-2 rounded-lg border border-line text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal/30"
              >
                <option value="managing_partner">Managing Partner</option>
                <option value="analyst">Analyst</option>
                <option value="viewer">Viewer</option>
              </select>
              {result?.ok && <Badge tone="teal">Sent</Badge>}
              {result && !result.ok && <Badge tone="default">Failed</Badge>}
              {invites.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-muted hover:text-coral p-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={add}
          className="w-full bg-paper2 border-2 border-dashed border-line hover:border-navy rounded-xl px-5 py-3 text-[12px] text-muted hover:text-navy inline-flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Add another teammate
        </button>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={onBack} disabled={pending} className="gap-1.5">
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </Button>
        <Button type="button" variant="gold" size="md" className="gap-1.5" onClick={onFinish} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {pending ? "Finishing…" : invites.some((i) => i.email.trim()) ? "Invite & open dashboard" : "Skip & open dashboard"}
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Atoms
// ---------------------------------------------------------------------------

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-line shadow-card p-6 sm:p-8">
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-semibold text-ink tracking-[0.14em] uppercase mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

function CellInput({
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
      <span className="block text-[9px] font-semibold text-muted tracking-[0.14em] uppercase mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        step={step}
        className="w-full h-9 px-2.5 rounded-md border border-line text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal/30 tabular-nums"
      />
    </label>
  );
}

function CellSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="block text-[9px] font-semibold text-muted tracking-[0.14em] uppercase mb-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 px-2.5 rounded-md border border-line text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal/30"
      >
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
}
