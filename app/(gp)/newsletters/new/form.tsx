"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createNewsletter } from "../actions";
import { defaultPeriodLabel, type NewsletterCadence } from "@/lib/newsletter-types";

const CADENCES: { value: NewsletterCadence; label: string; hint: string }[] = [
  { value: "quarterly", label: "Quarterly",  hint: "Standard LP letter cadence" },
  { value: "monthly",   label: "Monthly",    hint: "Lighter recap, more frequent" },
  { value: "annual",    label: "Annual",     hint: "Year-end fund letter" },
  { value: "ad_hoc",    label: "Ad-hoc",     hint: "One-off update or special note" },
];

export function NewNewsletterForm() {
  const router = useRouter();
  const [cadence, setCadence] = useState<NewsletterCadence>("quarterly");
  const [periodLabel, setPeriodLabel] = useState<string>(defaultPeriodLabel("quarterly"));
  const [autoDraft, setAutoDraft] = useState(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pickCadence(c: NewsletterCadence) {
    setCadence(c);
    setPeriodLabel(defaultPeriodLabel(c));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createNewsletter({ cadence, periodLabel, autoDraft });
      if (!res.ok) { setError(res.error); return; }
      router.push(`/newsletters/${res.id}/edit`);
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-line shadow-card p-6 space-y-5">
      <div>
        <h2 className="font-serif text-lg font-bold text-ink">Generate your next LP letter</h2>
        <p className="text-[12px] text-muted mt-1">
          Pulso drafts a starting point from your portfolio data — KPIs, standout companies, watch list.
          You edit and publish when ready.
        </p>
      </div>

      <div>
        <label className="block text-[10px] font-semibold text-ink tracking-[0.14em] uppercase mb-1.5">
          Cadence
        </label>
        <div className="grid grid-cols-2 gap-2">
          {CADENCES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => pickCadence(c.value)}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-left transition-colors",
                cadence === c.value
                  ? "border-navy bg-navy/5 text-navy"
                  : "border-line text-muted hover:border-navy/40 hover:text-ink"
              )}
            >
              <div className="text-sm font-semibold">{c.label}</div>
              <div className="text-[10px] mt-0.5">{c.hint}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-semibold text-ink tracking-[0.14em] uppercase mb-1">
          Period label
        </label>
        <input
          value={periodLabel}
          onChange={(e) => setPeriodLabel(e.target.value)}
          maxLength={60}
          className="w-full h-10 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
        />
        <p className="mt-1 text-[10px] text-muted">
          Shown on the cover. e.g. "Q2 2026", "FY 2026", "March 2026".
        </p>
      </div>

      <div className="rounded-lg border border-line p-3 bg-paper2/40">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoDraft}
            onChange={(e) => setAutoDraft(e.target.checked)}
            className="h-3.5 w-3.5 mt-0.5 rounded text-teal"
          />
          <div className="flex-1">
            <div className="text-sm font-semibold text-ink inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-gold-600" />
              Auto-draft from portfolio data
            </div>
            <p className="text-[11px] text-muted mt-0.5">
              Pulls current KPIs, standouts (top MoM ARR), and watch list. Adds a "What's next" section
              for you to fill in. Uncheck for a blank starting point.
            </p>
          </div>
        </label>
      </div>

      {error && (
        <div className="rounded-md border border-coral/30 bg-coral/10 text-coral px-3 py-2 text-[12px]">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={() => router.push("/newsletters")} disabled={pending}>
          Cancel
        </Button>
        <Button variant="gold" size="sm" className="gap-1.5" onClick={submit} disabled={pending}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
          {pending ? "Generating…" : "Create draft"}
        </Button>
      </div>
    </div>
  );
}
