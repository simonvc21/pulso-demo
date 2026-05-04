"use client";

// L.10 / Fase 1.5 — Modal-ish picker to create a new column. Pick type, give
// it a name, done. Per-type config (decimals, options, currency code, etc.)
// is editable later via the header menu — Fase 2 will surface that inline.

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { addColumn, type ColumnType } from "@/app/(gp)/companies/[slug]/sheets/actions";
import { COLUMN_TYPE_LABELS } from "./types";

const TYPE_ORDER: ColumnType[] = [
  "text", "long_text", "number", "currency", "percent",
  "date", "single_select", "checkbox", "attachment_url",
];

export function AddColumnButton({ sheetId }: { sheetId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<ColumnType>("text");
  const [pending, setPending] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    const config = type === "currency" ? { currency: "USD" } : type === "percent" ? { decimals: 1 } : {};
    const res = await addColumn(sheetId, type, name.trim(), config);
    setPending(false);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    setName("");
    setType("text");
    setOpen(false);
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-muted hover:text-ink hover:bg-paper2 rounded-md"
      >
        <Plus className="h-3.5 w-3.5" /> Add column
      </button>
      {open && (
        <form
          onSubmit={onSubmit}
          className="absolute top-full right-0 mt-1 z-30 w-72 bg-white border border-line rounded-lg shadow-cardHover p-3 space-y-2"
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Column name"
            className="w-full px-2 py-1.5 text-sm border border-line rounded focus:border-teal/60 focus:ring-2 focus:ring-teal/20 outline-none"
          />
          <div className="grid grid-cols-2 gap-1">
            {TYPE_ORDER.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  "px-2 py-1 text-xs text-left rounded border",
                  type === t
                    ? "border-teal/60 bg-teal-50 text-teal-600"
                    : "border-line text-ink hover:bg-paper2",
                )}
              >
                {COLUMN_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-1 text-xs text-muted hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || !name.trim()}
              className="px-3 py-1 text-xs font-medium bg-navy text-white rounded hover:bg-navy-700 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
