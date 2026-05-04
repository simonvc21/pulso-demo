"use client";

// L.10/Fase 1.G — Per-row delete control on /lps. Uses confirm() for now,
// since the rest of the destructive ops in the app already use it.

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { deleteLp } from "./actions";

export function DeleteLpButton({ lpId, name }: { lpId: string; name: string }) {
  const [pending, setPending] = useState(false);

  async function onClick() {
    if (!confirm(`Delete ${name}? This removes them from the LP roster and any chat thread. This can't be undone.`)) return;
    setPending(true);
    const res = await deleteLp(lpId);
    setPending(false);
    if (!res.ok) alert(res.error);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="text-muted hover:text-coral p-1.5 inline-flex disabled:opacity-50"
      title={`Delete ${name}`}
      aria-label={`Delete ${name}`}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}
