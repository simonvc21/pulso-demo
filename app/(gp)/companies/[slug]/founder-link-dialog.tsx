"use client";

// L.4e — Founder link manager. Generates per-founder tokens, lets the GP copy
// the URL once, see usage stats, and revoke when needed.

import { useState, useTransition } from "react";
import { Copy, Check, X, Loader2, Plus, Link as LinkIcon, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateFillToken, revokeFillToken } from "./fill-token-actions";
import type { FillTokenRow } from "@/lib/fill-tokens";

interface Props {
  companyId: string;
  companySlug: string;
  initialTokens: FillTokenRow[];
  onClose: () => void;
}

export function FounderLinkDialog({ companyId, companySlug, initialTokens, onClose }: Props) {
  const [tokens, setTokens] = useState<FillTokenRow[]>(initialTokens);
  const [pending, startTransition] = useTransition();
  const [creatingLabel, setCreatingLabel] = useState("");
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const create = () => {
    startTransition(async () => {
      const res = await generateFillToken({
        companyId,
        label: creatingLabel.trim() || null,
      });
      if (!res.ok) { alert(res.error); return; }
      const now = new Date().toISOString();
      const newRow: FillTokenRow = {
        id: crypto.randomUUID(),
        token: res.token,
        label: creatingLabel.trim() || null,
        createdAt: now,
        lastUsedAt: null,
        useCount: 0,
      };
      setTokens([newRow, ...tokens]);
      setCreatingLabel("");
    });
  };

  const revoke = (tokenId: string, label: string | null) => {
    if (!confirm(`Revoke ${label ?? "this link"}? The founder will lose access immediately and need a new link.`)) return;
    startTransition(async () => {
      const res = await revokeFillToken({ tokenId, companySlug });
      if (!res.ok) { alert(res.error); return; }
      setTokens(tokens.filter((t) => t.id !== tokenId));
    });
  };

  const copy = async (token: string, tokenId: string) => {
    const url = `${baseUrl}/fill/current?token=${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedTokenId(tokenId);
      setTimeout(() => setCopiedTokenId(null), 1500);
    } catch {
      alert(url);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-navy/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-cardHover w-full max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-3 border-b border-line">
          <div>
            <h3 className="text-sm font-semibold text-ink">Founder links</h3>
            <p className="text-[11px] text-muted mt-0.5">
              Each link gates form submissions for this company. Share with the founder, revoke when they leave.
            </p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink"><X className="h-4 w-4" /></button>
        </header>

        <div className="px-5 py-4 space-y-4">
          {/* Create */}
          <div className="bg-paper2/50 rounded-lg border border-line p-3">
            <label className="block text-[10px] font-semibold text-muted tracking-[0.14em] uppercase mb-1.5">
              Generate a new link
            </label>
            <div className="flex items-center gap-2">
              <input
                value={creatingLabel}
                onChange={(e) => setCreatingLabel(e.target.value)}
                placeholder="Label (optional) — e.g. Ana Garcia, CEO"
                maxLength={60}
                className="flex-1 h-9 px-2.5 rounded-md border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
              />
              <Button
                variant="gold"
                size="sm"
                className="gap-1.5 shrink-0"
                onClick={create}
                disabled={pending}
              >
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Create link
              </Button>
            </div>
          </div>

          {/* Existing tokens */}
          {tokens.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line bg-paper2/30 p-6 text-center">
              <LinkIcon className="h-5 w-5 mx-auto text-muted" />
              <div className="mt-2 text-sm font-semibold text-ink">No links yet</div>
              <p className="text-[12px] text-muted mt-1 max-w-md mx-auto">
                Once you create the first link, the legacy <code className="bg-paper2 px-1 rounded text-[11px]">?company={companySlug}</code> URL stops working. Existing demo links keep working only while no link exists.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-line overflow-hidden">
              <div className="bg-paper2/40 border-b border-line px-3 py-2 flex items-center gap-2 text-[11px]">
                <AlertTriangle className="h-3 w-3 text-gold-600 shrink-0" />
                <span className="text-muted">
                  Founders can submit forms only with one of these links. The legacy public URL is locked.
                </span>
              </div>
              <ul className="divide-y divide-line">
                {tokens.map((t) => {
                  const url = `${baseUrl}/fill/current?token=${t.token}`;
                  return (
                    <li key={t.id} className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-ink truncate">
                            {t.label ?? "Unlabeled link"}
                          </div>
                          <div className="text-[10px] text-muted mt-0.5">
                            Created {new Date(t.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
                            {t.lastUsedAt
                              ? ` · last used ${new Date(t.lastUsedAt).toLocaleDateString("en-US", { dateStyle: "medium" })} (${t.useCount} submission${t.useCount === 1 ? "" : "s"})`
                              : " · never used"}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 shrink-0"
                          onClick={() => copy(t.token, t.id)}
                        >
                          {copiedTokenId === t.id
                            ? <><Check className="h-3.5 w-3.5 text-teal-600" /> Copied</>
                            : <><Copy className="h-3.5 w-3.5" /> Copy URL</>}
                        </Button>
                        <button
                          type="button"
                          onClick={() => revoke(t.id, t.label)}
                          disabled={pending}
                          className="p-1.5 text-muted hover:text-coral disabled:opacity-50"
                          aria-label="Revoke link"
                          title="Revoke link"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="mt-2 px-2 py-1.5 rounded bg-paper2 font-mono text-[10px] text-muted truncate">
                        {url}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <footer className="px-5 py-3 border-t border-line bg-paper2/40 flex items-center justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Done</Button>
        </footer>
      </div>
    </div>
  );
}
