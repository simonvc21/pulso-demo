"use client";

// L.10 / Fase 1.D — List of active share links for one dashboard. Each
// supports copy-to-clipboard and revoke.

import { useState } from "react";
import { Copy, Check, Trash2, Eye } from "lucide-react";
import { revokeShareLink } from "./actions";

interface ShareRow {
  id: string;
  token: string;
  watermark_email: string | null;
  view_count: number;
  created_at: string;
}

export function ShareLinkList({ shares }: { shares: ShareRow[] }) {
  return (
    <ul className="space-y-1.5">
      {shares.map((s) => (
        <ShareLinkRow key={s.id} share={s} />
      ))}
    </ul>
  );
}

function ShareLinkRow({ share }: { share: ShareRow }) {
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);
  const url = typeof window !== "undefined"
    ? `${window.location.origin}/d/${share.token}`
    : `/d/${share.token}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select-and-prompt
      window.prompt("Copy link:", url);
    }
  }

  async function revoke() {
    if (!confirm("Revoke this share link? It will stop working immediately.")) return;
    setPending(true);
    const res = await revokeShareLink(share.id);
    setPending(false);
    if (!res.ok) alert(res.error);
  }

  return (
    <li className={pending ? "opacity-50" : ""}>
      <div className="flex items-center gap-2 text-[11px]">
        <button
          type="button"
          onClick={copy}
          className="flex-1 min-w-0 inline-flex items-center gap-1.5 px-2 py-1 text-left rounded border border-line bg-paper2/50 hover:bg-paper2 text-ink"
          title={url}
        >
          {copied ? <Check className="h-3 w-3 text-teal-600 shrink-0" /> : <Copy className="h-3 w-3 text-muted shrink-0" />}
          <span className="truncate font-mono">{url}</span>
        </button>
        {share.watermark_email && (
          <span className="text-muted">{share.watermark_email}</span>
        )}
        <span className="inline-flex items-center gap-1 text-muted">
          <Eye className="h-3 w-3" /> {share.view_count}
        </span>
        <button
          type="button"
          onClick={revoke}
          disabled={pending}
          className="p-1 rounded text-muted hover:text-coral hover:bg-red-50"
          aria-label="Revoke link"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </li>
  );
}
