"use client";

// L.10 / Fase 1.6 — Naming form for the first sheet. Calls createSheet,
// then router.push to /companies/[slug]/sheets/[id].

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSheet } from "@/app/(gp)/companies/[slug]/sheets/actions";

export function NewSheetForm({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [name, setName] = useState("KPIs trimestrales");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    setError(null);
    const res = await createSheet(companyId, name.trim());
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push(`/companies/${res.data.companySlug}/sheets/${res.data.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-3">
      <div>
        <label className="block text-xs uppercase tracking-wide text-muted mb-1.5">
          Sheet name
        </label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-line rounded focus:border-teal/60 focus:ring-2 focus:ring-teal/20 outline-none"
        />
      </div>
      {error && <p className="text-xs text-coral">{error}</p>}
      <button
        type="submit"
        disabled={pending || !name.trim()}
        className="px-4 py-2 text-sm font-medium bg-navy text-white rounded hover:bg-navy-700 disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create sheet"}
      </button>
    </form>
  );
}
