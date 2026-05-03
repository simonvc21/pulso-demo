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

// L.6d — Suggested prompts. Click to set the prompt; user can edit further.
const SUGGESTED_PROMPTS: { label: string; prompt: string }[] = [
  {
    label: "Confident growth-mode update",
    prompt: "Frame this as a confident, growth-focused update. Emphasize MoM ARR momentum, the standout companies, and how we're leaning into our thesis. Mention specific deployments if any. Keep tone professional but optimistic.",
  },
  {
    label: "Cautious / market-aware",
    prompt: "Take a cautious, market-aware tone. Acknowledge headwinds in the broader market, highlight runway management across the portfolio, and how we're working with founders on capital efficiency. Honest about the watch list.",
  },
  {
    label: "Thesis check-in",
    prompt: "Frame this as a thesis check-in. Tie the portfolio's progress back to our investment thesis (LATAM B2B SaaS / fintech / etc). Highlight which companies are the strongest validation and where we're learning.",
  },
  {
    label: "End-of-period reflection",
    prompt: "Reflective tone. Look back at the period: what went well, what surprised us, what we'd do differently. Close with priorities for the next period and how LPs can help (intros, hires, etc).",
  },
];

export function NewNewsletterForm() {
  const router = useRouter();
  const [cadence, setCadence] = useState<NewsletterCadence>("quarterly");
  const [periodLabel, setPeriodLabel] = useState<string>(defaultPeriodLabel("quarterly"));
  const [autoDraft, setAutoDraft] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pickCadence(c: NewsletterCadence) {
    setCadence(c);
    setPeriodLabel(defaultPeriodLabel(c));
  }

  function pickPrompt(p: string) {
    setPrompt(p);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createNewsletter({
        cadence,
        periodLabel,
        autoDraft,
        prompt: prompt.trim() || undefined,
      });
      if (!res.ok) { setError(res.error); return; }
      router.push(`/newsletters/${res.id}/edit`);
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-line shadow-card p-6 space-y-5">
      <div>
        <h2 className="font-serif text-lg font-bold text-ink">Generate your next LP letter</h2>
        <p className="text-[12px] text-muted mt-1">
          Pulso drafts a starting point from your portfolio data — KPIs, charts, per-company paragraphs,
          watch list. Add a prompt below to steer the tone and emphasis. You edit and publish when ready.
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

      {/* L.6d — AI prompt + suggestions */}
      <div>
        <label className="block text-[10px] font-semibold text-ink tracking-[0.14em] uppercase mb-1.5 inline-flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-gold-600" />
          Tell the AI what to focus on (optional)
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          maxLength={1500}
          placeholder="e.g. Highlight Vextra's $4M extension round and Lumen's product launch. Be honest about Brio's runway. Closing should set up the Q1 fundraise from LPs."
          className="w-full px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 resize-none leading-relaxed"
        />
        <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-muted mr-1">Try:</span>
            {SUGGESTED_PROMPTS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => pickPrompt(s.prompt)}
                className="text-[11px] px-2 py-1 rounded-md border border-line bg-paper2/50 text-ink hover:border-gold/40 hover:bg-gold-50 transition-colors"
              >
                {s.label}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-muted tabular-nums">{prompt.length} / 1500</span>
        </div>
        <p className="mt-2 text-[10px] text-muted leading-relaxed">
          When set, the AI rewrites the Overview + Outlook paragraphs with this framing while keeping every
          number and company name from your real data. Per-company paragraphs stay grounded in metrics.
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
              Pulls KPIs, charts, per-company paragraphs, watch list. Uncheck for a blank starting point
              (the prompt is ignored too).
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
          {pending ? (prompt ? "Generating with AI…" : "Generating…") : (prompt ? "Create AI-steered draft" : "Create draft")}
        </Button>
      </div>
    </div>
  );
}
