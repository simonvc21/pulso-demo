"use client";

// L.10 / Fase 1.D — Mint a share link. Optional email watermark.

import { useState } from "react";
import { Share2, Loader2 } from "lucide-react";
import { createShareLink, type ShareKind } from "./actions";

export function ShareLinkButton({
  kind,
  companyId,
}: {
  kind: ShareKind;
  companyId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await createShareLink({
      kind,
      companyId: companyId ?? null,
      watermarkEmail: email.trim() || null,
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOpen(false);
    setEmail("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-gold text-navy hover:bg-gold-600"
      >
        <Share2 className="h-3.5 w-3.5" /> Share
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/30 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <form
            onSubmit={onSubmit}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl border border-line shadow-cardHover w-full max-w-md p-5 m-4"
          >
            <h3 className="font-serif text-lg text-ink mb-1">Share dashboard</h3>
            <p className="text-xs text-muted mb-4">
              Anyone with the link can view a read-only snapshot. Optionally watermark the page with the recipient's email so the link can be traced.
            </p>
            <label className="block text-xs uppercase tracking-wide text-muted mb-1.5">
              Watermark email (optional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="lp@fund.com"
              className="w-full px-3 py-2 text-sm border border-line rounded focus:border-teal/60 focus:ring-2 focus:ring-teal/20 outline-none"
            />
            {error && <p className="mt-2 text-xs text-coral">{error}</p>}
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-line">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm text-muted hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-navy text-white rounded hover:bg-navy-700 disabled:opacity-50"
              >
                {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Mint link
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
