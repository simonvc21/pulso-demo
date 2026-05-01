"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addLp } from "./actions";

const types = ["Family Office", "Institutional", "Fund of Funds", "Individual"] as const;

export function AddLpButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof types)[number]>("Family Office");
  const [commitment, setCommitment] = useState("");
  const [country, setCountry] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setName(""); setType("Family Office"); setCommitment("");
    setCountry(""); setEmail(""); setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await addLp({
        name,
        type,
        commitmentUsd: parseFloat(commitment) || 0,
        country: country || null,
        email: email || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      reset();
      router.refresh();
    });
  };

  return (
    <>
      <Button variant="primary" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> Add LP
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 bg-navy/30 flex items-center justify-center p-4" onClick={() => !pending && setOpen(false)}>
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-cardHover w-full max-w-md p-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-serif font-bold text-ink">Add LP</h2>
              <button type="button" onClick={() => !pending && setOpen(false)} className="text-muted hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <Field label="Name">
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Andina Capital Partners"
                  className="w-full h-10 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
                />
              </Field>

              <Field label="Type">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as (typeof types)[number])}
                  className="w-full h-10 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
                >
                  {types.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>

              <Field label="Commitment (USD)">
                <input
                  required
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={commitment}
                  onChange={(e) => setCommitment(e.target.value)}
                  placeholder="20000000"
                  className="w-full h-10 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 tabular-nums"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Country (ISO)">
                  <input
                    value={country}
                    onChange={(e) => setCountry(e.target.value.toUpperCase())}
                    placeholder="MX"
                    maxLength={2}
                    className="w-full h-10 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contact@lp.com"
                    className="w-full h-10 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
                  />
                </Field>
              </div>
            </div>

            {error && (
              <div className="mt-4 text-[12px] text-coral bg-red-50 border border-red-100 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" variant="gold" size="sm" className="gap-1.5" disabled={pending}>
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                {pending ? "Saving…" : "Add LP"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold text-ink tracking-wide uppercase mb-1">{label}</span>
      {children}
    </label>
  );
}
