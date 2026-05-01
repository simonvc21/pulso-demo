"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Calendar, Save, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateFund } from "./actions";

interface Props {
  initial: {
    name: string;
    vintage: number | null;
    sizeUsd: number;
    deployedUsd: number;
    currency: string;
  };
}

export function FundForm({ initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [vintage, setVintage] = useState(initial.vintage?.toString() ?? "");
  const [sizeUsd, setSizeUsd] = useState(initial.sizeUsd.toString());
  const [deployedUsd, setDeployedUsd] = useState(initial.deployedUsd.toString());
  const [currency, setCurrency] = useState(initial.currency);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty =
    name !== initial.name ||
    (parseInt(vintage, 10) || null) !== (initial.vintage ?? null) ||
    parseFloat(sizeUsd) !== initial.sizeUsd ||
    parseFloat(deployedUsd) !== initial.deployedUsd ||
    currency !== initial.currency;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await updateFund({
        name,
        vintage: vintage ? parseInt(vintage, 10) : null,
        sizeUsd: sizeUsd ? parseFloat(sizeUsd) : null,
        deployedUsd: deployedUsd ? parseFloat(deployedUsd) : null,
        currency,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSavedAt(Date.now());
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Field icon={Building2} label="Fund name">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full h-10 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field icon={Calendar} label="Vintage">
          <input
            type="number"
            inputMode="numeric"
            value={vintage}
            onChange={(e) => setVintage(e.target.value)}
            placeholder="2024"
            className="w-full h-10 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
          />
        </Field>
        <Field icon={Building2} label="Currency">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
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

      <div className="grid grid-cols-2 gap-3">
        <Field icon={Building2} label="Fund size (USD)">
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={sizeUsd}
            onChange={(e) => setSizeUsd(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 tabular-nums"
          />
        </Field>
        <Field icon={Building2} label="Deployed (USD)">
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={deployedUsd}
            onChange={(e) => setDeployedUsd(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 tabular-nums"
          />
        </Field>
      </div>

      {error && (
        <div className="text-[12px] text-coral bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        {savedAt && !dirty ? (
          <span className="text-[11px] text-teal-600 inline-flex items-center gap-1.5">
            <Check className="h-3 w-3" /> Saved
          </span>
        ) : <span />}
        <Button type="submit" variant="gold" size="sm" className="gap-1.5" disabled={pending || !dirty}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  icon: Icon, label, children,
}: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold text-muted tracking-[0.14em] uppercase mb-1 inline-flex items-center gap-1.5">
        <Icon className="h-3 w-3" /> {label}
      </span>
      {children}
    </label>
  );
}
