"use client";

// L.10 / Fase 1.5 — Append an empty row at the bottom of the grid.

import { useState } from "react";
import { Plus } from "lucide-react";
import { addRow } from "@/app/(gp)/companies/[slug]/sheets/actions";

export function AddRowButton({ sheetId }: { sheetId: string }) {
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    const res = await addRow(sheetId, {});
    setPending(false);
    if (!res.ok) alert(res.error);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-muted hover:text-ink hover:bg-paper2 rounded-md disabled:opacity-50"
    >
      <Plus className="h-3.5 w-3.5" /> Add row
    </button>
  );
}
