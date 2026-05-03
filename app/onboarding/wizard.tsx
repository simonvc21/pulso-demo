"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Zap, Building2, Users, Check, ChevronRight, ChevronLeft, Loader2,
  Plus, Trash2, ArrowRight, FileText, Briefcase, BarChart3, Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  createFund, importCompanies, importLps, importMetrics, listOrgCompanies, finishOnboarding,
  type CompanyDraft, type LpDraft, type MetricDraft, type OrgCompanyRef,
} from "./actions";
import { inviteUser } from "../(gp)/settings/team-actions";
import { FUND_ROLES, type FundRole } from "@/lib/roles";

type Step = 1 | 2 | 3 | 4 | 5;

interface Props {
  userEmail: string;
  userName: string | null;
}

export function OnboardingWizard({ userEmail, userName }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Step 1 — fund profile
  const [fundName, setFundName] = useState("");
  const [vintage, setVintage] = useState(String(new Date().getFullYear()));
  const [sizeUsd, setSizeUsd] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [thesis, setThesis] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");

  // Step 2 — LPs
  const [lps, setLps] = useState<LpDraft[]>([emptyLp()]);

  // Step 3 — team
  const [invites, setInvites] = useState<{ email: string; role: FundRole }[]>([{ email: "", role: "analyst" }]);
  const [invitesResults, setInvitesResults] = useState<Array<{ email: string; ok: boolean; error?: string }>>([]);

  // Step 4 — companies
  const [companies, setCompanies] = useState<CompanyDraft[]>([emptyCompany()]);

  // Step 5 — historical metrics (per company × quarter)
  const [metrics, setMetrics] = useState<MetricDraft[]>([]);
  const [orgCompanies, setOrgCompanies] = useState<OrgCompanyRef[]>([]);

  // ── Step 1 submit ──
  const submitStep1 = () => {
    if (!fundName.trim()) { setError("Fund name is required"); return; }
    setError(null);
    startTransition(async () => {
      const res = await createFund({
        name: fundName,
        vintage: vintage ? parseInt(vintage, 10) : null,
        sizeUsd: sizeUsd ? parseFloat(sizeUsd) : null,
        currency,
        thesis,
        description,
        website,
      });
      if (!res.ok) { setError(res.error); return; }
      setStep(2);
    });
  };

  // ── Step 2 submit (LPs) ──
  const submitStep2 = () => {
    setError(null);
    const valid = lps.filter((l) => l.name.trim().length > 0);
    if (valid.length === 0) { setStep(3); return; }
    startTransition(async () => {
      const res = await importLps(valid);
      if (!res.ok) { setError(res.error); return; }
      setStep(3);
    });
  };

  // ── Step 3 submit (team) ──
  const submitStep3 = () => {
    setError(null);
    const valid = invites.filter((i) => i.email.trim().length > 0);
    if (valid.length === 0) { setStep(4); return; }
    startTransition(async () => {
      const results: typeof invitesResults = [];
      for (const inv of valid) {
        const res = await inviteUser({ email: inv.email, role: inv.role });
        results.push({ email: inv.email, ok: res.ok, error: res.ok ? undefined : res.error });
      }
      setInvitesResults(results);
      setTimeout(() => setStep(4), 800);
    });
  };

  // ── Step 4 submit (companies) ──
  const submitStep4 = () => {
    setError(null);
    const valid = companies.filter((c) => c.name.trim().length > 0);
    if (valid.length === 0) { setStep(5); return; }
    startTransition(async () => {
      const res = await importCompanies(valid);
      if (!res.ok) { setError(res.error); return; }
      setStep(5);
    });
  };

  // When entering Step 5, fetch the org's companies so the user can pick which one to add metrics for.
  useEffect(() => {
    if (step !== 5) return;
    let cancelled = false;
    listOrgCompanies().then((rows) => {
      if (cancelled) return;
      setOrgCompanies(rows);
      // Seed one empty metric row pointing to the first company if any exist.
      setMetrics((m) => (m.length === 0 && rows.length > 0 ? [emptyMetric(rows[0].slug)] : m));
    });
    return () => { cancelled = true; };
  }, [step]);

  // ── Step 5 submit (metrics) → finish ──
  const submitStep5 = () => {
    setError(null);
    startTransition(async () => {
      const valid = metrics.filter((m) => m.companySlug && m.quarter.trim());
      if (valid.length > 0) {
        const res = await importMetrics(valid);
        if (!res.ok) { setError(res.error); return; }
      }
      await finishOnboarding();
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
            thesis={thesis} setThesis={setThesis}
            description={description} setDescription={setDescription}
            website={website} setWebsite={setWebsite}
            onNext={submitStep1}
            pending={pending}
          />
        )}

        {step === 2 && (
          <Step2Lps
            lps={lps} setLps={setLps}
            onBack={() => setStep(1)}
            onNext={submitStep2}
            pending={pending}
          />
        )}

        {step === 3 && (
          <Step3Team
            invites={invites} setInvites={setInvites} results={invitesResults}
            onBack={() => setStep(2)}
            onNext={submitStep3}
            pending={pending}
          />
        )}

        {step === 4 && (
          <Step4Companies
            companies={companies} setCompanies={setCompanies}
            onBack={() => setStep(3)}
            onNext={submitStep4}
            pending={pending}
          />
        )}

        {step === 5 && (
          <Step5Metrics
            metrics={metrics} setMetrics={setMetrics}
            orgCompanies={orgCompanies}
            onBack={() => setStep(4)}
            onFinish={submitStep5}
            pending={pending}
          />
        )}
      </div>
    </div>
  );
}

function emptyCompany(): CompanyDraft {
  return {
    name: "", sector: "", country: "", stage: "Seed", status: "no_data",
    investedUsd: 0, ownershipPct: 0, founderName: "", founderEmail: "",
  };
}

function emptyLp(): LpDraft {
  return { name: "", type: "Family Office", commitmentUsd: 0, country: "", email: "" };
}

function emptyMetric(slug: string): MetricDraft {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1;
  return {
    companySlug: slug,
    quarter: `Q${q} ${now.getFullYear()}`,
    arrUsd: null, burnUsd: null, cashUsd: null, revenueUsd: null, headcount: null,
  };
}

// ---------------------------------------------------------------------------
// Stepper
// ---------------------------------------------------------------------------

function Stepper({ step }: { step: Step }) {
  const items = [
    { n: 1, label: "Fund", icon: Building2 },
    { n: 2, label: "LPs", icon: Briefcase },
    { n: 3, label: "Team", icon: Users },
    { n: 4, label: "Portfolio", icon: FileText },
    { n: 5, label: "Metrics", icon: BarChart3 },
  ] as const;
  return (
    <div className="mb-8 flex items-center gap-2 sm:gap-3">
      {items.map((it, i) => {
        const active = step === it.n;
        const done = step > it.n;
        return (
          <div key={it.n} className="flex items-center gap-2 sm:gap-3 flex-1 last:flex-none">
            <div className={cn(
              "h-8 w-8 sm:h-9 sm:w-9 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold shrink-0 border-2",
              active ? "bg-navy text-gold border-navy"
              : done ? "bg-teal text-white border-teal"
              : "bg-white text-muted border-line"
            )}>
              {done ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : it.n}
            </div>
            <div className="hidden md:block">
              <div className={cn("text-[10px] tracking-[0.14em] uppercase font-semibold", active ? "text-gold-600" : done ? "text-teal-600" : "text-muted")}>
                Step {it.n}
              </div>
              <div className={cn("text-sm font-medium", active || done ? "text-ink" : "text-muted")}>
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
// Step 1 — Fund profile
// ---------------------------------------------------------------------------

function Step1({
  name, setName, vintage, setVintage, sizeUsd, setSizeUsd, currency, setCurrency,
  thesis, setThesis, description, setDescription, website, setWebsite,
  onNext, pending,
}: {
  name: string; setName: (v: string) => void;
  vintage: string; setVintage: (v: string) => void;
  sizeUsd: string; setSizeUsd: (v: string) => void;
  currency: string; setCurrency: (v: string) => void;
  thesis: string; setThesis: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  website: string; setWebsite: (v: string) => void;
  onNext: () => void; pending: boolean;
}) {
  return (
    <Card>
      <h1 className="text-2xl font-serif font-bold text-ink">Tell us about your fund</h1>
      <p className="mt-1 text-sm text-muted">You can edit any of this later in Settings → Fund profile.</p>

      <form onSubmit={(e) => { e.preventDefault(); onNext(); }} className="mt-6 space-y-4">
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
            <input type="number" value={vintage} onChange={(e) => setVintage(e.target.value)} placeholder="2024"
              className="w-full h-11 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 tabular-nums" />
          </Field>
          <Field label="Fund size (USD)">
            <input type="number" min="0" value={sizeUsd} onChange={(e) => setSizeUsd(e.target.value)} placeholder="80000000"
              className="w-full h-11 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 tabular-nums" />
          </Field>
          <Field label="Currency">
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30">
              <option>USD</option><option>BRL</option><option>MXN</option><option>CLP</option><option>ARS</option><option>COP</option><option>PEN</option>
            </select>
          </Field>
        </div>

        <Field label="One-liner (description)">
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="LATAM seed fund for B2B SaaS founders"
            className="w-full h-11 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30" />
        </Field>

        <Field label="Investment thesis (visible to LPs)">
          <textarea value={thesis} onChange={(e) => setThesis(e.target.value)} rows={4}
            placeholder="We back capital-efficient B2B founders building software for LATAM enterprises. We lead seed rounds, write $500K–$2M checks, and stay deeply involved through Series A."
            className="w-full px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30" />
        </Field>

        <Field label="Website (optional)">
          <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://patagonia.vc"
            className="w-full h-11 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30" />
        </Field>

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
// Step 2 — LPs
// ---------------------------------------------------------------------------

function Step2Lps({
  lps, setLps, onBack, onNext, pending,
}: {
  lps: LpDraft[];
  setLps: React.Dispatch<React.SetStateAction<LpDraft[]>>;
  onBack: () => void; onNext: () => void; pending: boolean;
}) {
  const update = (i: number, patch: Partial<LpDraft>) =>
    setLps((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const remove = (i: number) => setLps((p) => p.filter((_, idx) => idx !== i));
  const add = () => setLps((p) => [...p, emptyLp()]);

  const filledCount = lps.filter((l) => l.name.trim()).length;

  return (
    <Card>
      <h1 className="text-2xl font-serif font-bold text-ink">Add your LPs</h1>
      <p className="mt-1 text-sm text-muted">
        LPs you add here will see your fund letters. Their email matches them automatically when they sign in. Skip if you'll add them later.
      </p>

      <div className="mt-5 space-y-3">
        {lps.map((l, i) => (
          <div key={i} className="bg-paper rounded-xl border border-line p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] font-semibold text-muted tracking-[0.14em] uppercase">LP {i + 1}</div>
              {lps.length > 1 && (
                <button type="button" onClick={() => remove(i)} className="text-muted hover:text-coral text-[11px] inline-flex items-center gap-1">
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <CellInput label="Name" required value={l.name} onChange={(v) => update(i, { name: v })} placeholder="Andina Family Office" />
              <CellSelect label="Type" value={l.type} onChange={(v) => update(i, { type: v as LpDraft["type"] })}
                options={["Family Office", "Institutional", "Fund of Funds", "Individual"]} />
              <CellInput label="Commitment (USD)" type="number" value={l.commitmentUsd ? String(l.commitmentUsd) : ""} onChange={(v) => update(i, { commitmentUsd: parseFloat(v) || 0 })} />
              <CellInput label="Country" value={l.country ?? ""} onChange={(v) => update(i, { country: v.toUpperCase() })} maxLength={2} placeholder="CL" />
              <CellInput label="Contact email" type="email" value={l.email ?? ""} onChange={(v) => update(i, { email: v || null })} placeholder="contact@andina.cl" />
            </div>
          </div>
        ))}

        <button type="button" onClick={add}
          className="w-full bg-paper2 border-2 border-dashed border-line hover:border-navy rounded-xl px-5 py-4 text-[13px] text-muted hover:text-navy inline-flex items-center justify-center gap-2 transition-colors">
          <Plus className="h-4 w-4" /> Add another LP
        </button>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={onBack} disabled={pending} className="gap-1.5">
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </Button>
        <Button type="button" variant="gold" size="md" className="gap-1.5" onClick={onNext} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
          {pending ? "Saving…" : filledCount > 0 ? `Save ${filledCount} LP${filledCount === 1 ? "" : "s"} & continue` : "Skip for now"}
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Team
// ---------------------------------------------------------------------------

function Step3Team({
  invites, setInvites, results, onBack, onNext, pending,
}: {
  invites: { email: string; role: FundRole }[];
  setInvites: React.Dispatch<React.SetStateAction<{ email: string; role: FundRole }[]>>;
  results: Array<{ email: string; ok: boolean; error?: string }>;
  onBack: () => void; onNext: () => void; pending: boolean;
}) {
  const update = (i: number, patch: Partial<{ email: string; role: FundRole }>) =>
    setInvites((p) => p.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const remove = (i: number) => setInvites((p) => p.filter((_, idx) => idx !== i));
  const add = () => setInvites((p) => [...p, { email: "", role: "analyst" }]);

  return (
    <Card>
      <h1 className="text-2xl font-serif font-bold text-ink">Invite your team</h1>
      <p className="mt-1 text-sm text-muted">They get an email with a magic link. You can manage permissions later in Settings → Team.</p>

      <div className="mt-5 space-y-2">
        {invites.map((inv, i) => {
          const result = results.find((r) => r.email.toLowerCase() === inv.email.trim().toLowerCase());
          return (
            <div key={i} className="bg-paper rounded-xl border border-line p-3 flex items-center gap-2">
              <input type="email" value={inv.email} onChange={(e) => update(i, { email: e.target.value })} placeholder="analyst@fund.com"
                className="flex-1 h-10 px-3 rounded-lg border border-line text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal/30" />
              <select value={inv.role} onChange={(e) => update(i, { role: e.target.value as FundRole })}
                className="h-10 px-2 rounded-lg border border-line text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal/30">
                {FUND_ROLES.filter((r) => r.value !== "gp").map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              {result?.ok && <Badge tone="teal">Sent</Badge>}
              {result && !result.ok && <Badge tone="default">Failed</Badge>}
              {invites.length > 1 && (
                <button type="button" onClick={() => remove(i)} className="text-muted hover:text-coral p-1">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}

        <button type="button" onClick={add}
          className="w-full bg-paper2 border-2 border-dashed border-line hover:border-navy rounded-xl px-5 py-3 text-[12px] text-muted hover:text-navy inline-flex items-center justify-center gap-2 transition-colors">
          <Plus className="h-3.5 w-3.5" /> Add another teammate
        </button>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={onBack} disabled={pending} className="gap-1.5">
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </Button>
        <Button type="button" variant="gold" size="md" className="gap-1.5" onClick={onNext} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
          {pending ? "Inviting…" : invites.some((i) => i.email.trim()) ? "Invite & continue" : "Skip for now"}
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Companies
// ---------------------------------------------------------------------------

function Step4Companies({
  companies, setCompanies, onBack, onNext, pending,
}: {
  companies: CompanyDraft[];
  setCompanies: React.Dispatch<React.SetStateAction<CompanyDraft[]>>;
  onBack: () => void; onNext: () => void; pending: boolean;
}) {
  const update = (i: number, patch: Partial<CompanyDraft>) =>
    setCompanies((p) => p.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const remove = (i: number) => setCompanies((p) => p.filter((_, idx) => idx !== i));
  const add = () => setCompanies((p) => [...p, emptyCompany()]);

  const filledCount = companies.filter((c) => c.name.trim()).length;

  return (
    <Card>
      <h1 className="text-2xl font-serif font-bold text-ink">Add your portfolio companies</h1>
      <p className="mt-1 text-sm text-muted">
        One row per company. CSV / Excel / PDF import is on the way — for now, type them in. You can always add more later.
      </p>

      <div className="mt-4">
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-1.5 text-[11px] text-muted cursor-not-allowed"
          title="Bulk import is on the roadmap (Phase B.4)"
        >
          <Upload className="h-3 w-3" /> Upload CSV / Excel / PDF · coming soon
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {companies.map((c, i) => (
          <div key={i} className="bg-paper rounded-xl border border-line p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] font-semibold text-muted tracking-[0.14em] uppercase">Company {i + 1}</div>
              {companies.length > 1 && (
                <button type="button" onClick={() => remove(i)} className="text-muted hover:text-coral text-[11px] inline-flex items-center gap-1">
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <CellInput label="Name" required value={c.name} onChange={(v) => update(i, { name: v })} />
              <CellInput label="Sector" value={c.sector ?? ""} onChange={(v) => update(i, { sector: v || null })} placeholder="Fintech" />
              <CellInput label="Country" value={c.country ?? ""} onChange={(v) => update(i, { country: v.toUpperCase() })} maxLength={2} placeholder="MX" />
              <CellSelect label="Stage" value={c.stage} onChange={(v) => update(i, { stage: v as any })} options={["Pre-seed", "Seed", "Series A", "Series B"]} />
              <CellInput label="Invested (USD)" type="number" value={String(c.investedUsd || "")} onChange={(v) => update(i, { investedUsd: parseFloat(v) || 0 })} />
              <CellInput label="Ownership %" type="number" step="0.1" value={String(c.ownershipPct || "")} onChange={(v) => update(i, { ownershipPct: parseFloat(v) || 0 })} />
              <CellInput label="Founder" value={c.founderName ?? ""} onChange={(v) => update(i, { founderName: v || null })} />
              <CellInput label="Founder email" type="email" value={c.founderEmail ?? ""} onChange={(v) => update(i, { founderEmail: v || null })} />
            </div>
          </div>
        ))}

        <button type="button" onClick={add}
          className="w-full bg-paper2 border-2 border-dashed border-line hover:border-navy rounded-xl px-5 py-4 text-[13px] text-muted hover:text-navy inline-flex items-center justify-center gap-2 transition-colors">
          <Plus className="h-4 w-4" /> Add another company
        </button>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={onBack} disabled={pending} className="gap-1.5">
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </Button>
        <Button type="button" variant="gold" size="md" className="gap-1.5" onClick={onNext} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
          {pending ? "Saving…" : filledCount > 0 ? `Import ${filledCount} & continue` : "Skip for now"}
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Step 5 — Historical metrics
// ---------------------------------------------------------------------------

function Step5Metrics({
  metrics, setMetrics, orgCompanies, onBack, onFinish, pending,
}: {
  metrics: MetricDraft[];
  setMetrics: React.Dispatch<React.SetStateAction<MetricDraft[]>>;
  orgCompanies: OrgCompanyRef[];
  onBack: () => void; onFinish: () => void; pending: boolean;
}) {
  const update = (i: number, patch: Partial<MetricDraft>) =>
    setMetrics((p) => p.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  const remove = (i: number) => setMetrics((p) => p.filter((_, idx) => idx !== i));
  const add = () => {
    if (orgCompanies.length === 0) return;
    setMetrics((p) => [...p, emptyMetric(orgCompanies[0].slug)]);
  };

  const filledCount = metrics.filter((m) => m.companySlug && m.quarter.trim()).length;

  return (
    <Card>
      <h1 className="text-2xl font-serif font-bold text-ink">Add historical metrics</h1>
      <p className="mt-1 text-sm text-muted">
        Backfill quarterly numbers if you have them. One row per company × quarter. Skip to start fresh — founders can submit going forward via forms.
      </p>

      {orgCompanies.length === 0 ? (
        <div className="mt-6 bg-paper rounded-xl border border-dashed border-line p-6 text-center">
          <div className="text-sm text-muted">
            No companies yet. Skip to finish — you can add metrics later from the Data tab.
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4">
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-1.5 text-[11px] text-muted cursor-not-allowed"
              title="Bulk import is on the roadmap (Phase B.4)"
            >
              <Upload className="h-3 w-3" /> Upload CSV / Excel / PDF · coming soon
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {metrics.length === 0 && (
              <div className="text-[12px] text-muted italic">No rows yet. Click "Add a quarter" below.</div>
            )}

            {metrics.map((m, i) => (
              <div key={i} className="bg-paper rounded-xl border border-line p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] font-semibold text-muted tracking-[0.14em] uppercase">Row {i + 1}</div>
                  <button type="button" onClick={() => remove(i)} className="text-muted hover:text-coral text-[11px] inline-flex items-center gap-1">
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <CellSelect
                    label="Company"
                    value={m.companySlug}
                    onChange={(v) => update(i, { companySlug: v })}
                    options={orgCompanies.map((c) => c.slug)}
                    optionLabels={Object.fromEntries(orgCompanies.map((c) => [c.slug, c.name]))}
                  />
                  <CellInput
                    label="Quarter"
                    value={m.quarter}
                    onChange={(v) => update(i, { quarter: v })}
                    placeholder="Q1 2026"
                  />
                  <CellInput label="ARR (USD)" type="number" value={m.arrUsd != null ? String(m.arrUsd) : ""}
                    onChange={(v) => update(i, { arrUsd: v.trim() === "" ? null : parseFloat(v) || 0 })} />
                  <CellInput label="Cash (USD)" type="number" value={m.cashUsd != null ? String(m.cashUsd) : ""}
                    onChange={(v) => update(i, { cashUsd: v.trim() === "" ? null : parseFloat(v) || 0 })} />
                  <CellInput label="Burn (USD)" type="number" value={m.burnUsd != null ? String(m.burnUsd) : ""}
                    onChange={(v) => update(i, { burnUsd: v.trim() === "" ? null : parseFloat(v) || 0 })} />
                  <CellInput label="Revenue (USD)" type="number" value={m.revenueUsd != null ? String(m.revenueUsd) : ""}
                    onChange={(v) => update(i, { revenueUsd: v.trim() === "" ? null : parseFloat(v) || 0 })} />
                  <CellInput label="Headcount" type="number" value={m.headcount != null ? String(m.headcount) : ""}
                    onChange={(v) => update(i, { headcount: v.trim() === "" ? null : parseInt(v) || 0 })} />
                </div>
              </div>
            ))}

            <button type="button" onClick={add}
              className="w-full bg-paper2 border-2 border-dashed border-line hover:border-navy rounded-xl px-5 py-4 text-[13px] text-muted hover:text-navy inline-flex items-center justify-center gap-2 transition-colors">
              <Plus className="h-4 w-4" /> Add a quarter
            </button>
          </div>
        </>
      )}

      <div className="mt-6 flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={onBack} disabled={pending} className="gap-1.5">
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </Button>
        <Button type="button" variant="gold" size="md" className="gap-1.5" onClick={onFinish} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {pending ? "Finishing…" : filledCount > 0 ? `Save ${filledCount} & open dashboard` : "Skip & open dashboard"}
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Atoms
// ---------------------------------------------------------------------------

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-2xl border border-line shadow-card p-6 sm:p-8">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-semibold text-ink tracking-[0.14em] uppercase mb-1">{label}</span>
      {children}
    </label>
  );
}

function CellInput({
  label, value, onChange, type = "text", placeholder, required, maxLength, step,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean; maxLength?: number; step?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[9px] font-semibold text-muted tracking-[0.14em] uppercase mb-1">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} required={required} maxLength={maxLength} step={step}
        className="w-full h-9 px-2.5 rounded-md border border-line text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal/30 tabular-nums" />
    </label>
  );
}

function CellSelect({
  label, value, onChange, options, optionLabels,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; optionLabels?: Record<string, string>;
}) {
  return (
    <label className="block">
      <span className="block text-[9px] font-semibold text-muted tracking-[0.14em] uppercase mb-1">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 px-2.5 rounded-md border border-line text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal/30">
        {options.map((o) => <option key={o} value={o}>{optionLabels?.[o] ?? o}</option>)}
      </select>
    </label>
  );
}
