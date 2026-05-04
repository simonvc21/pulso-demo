"use client";

// L.10 / Fase 1.5 — Column header. Click the chevron for rename / change-type
// / delete. Clicking the name itself toggles to inline rename.

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Trash2, Pencil, Type } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  updateColumn,
  deleteColumn,
  type ColumnType,
} from "@/app/(gp)/companies/[slug]/sheets/actions";
import { type SheetColumn, COLUMN_TYPE_LABELS } from "./types";

const TYPE_ORDER: ColumnType[] = [
  "text", "long_text", "number", "currency", "percent",
  "date", "single_select", "checkbox", "attachment_url",
];

export function SheetHeaderCell({ column }: { column: SheetColumn }) {
  const [renaming, setRenaming] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  async function commitRename(name: string) {
    const trimmed = name.trim();
    setRenaming(false);
    if (!trimmed || trimmed === column.name) return;
    setPending(true);
    const res = await updateColumn(column.id, { name: trimmed });
    setPending(false);
    if (!res.ok) console.error("rename column failed", res.error);
  }

  async function changeType(type: ColumnType) {
    setMenuOpen(false);
    if (type === column.type) return;
    setPending(true);
    const res = await updateColumn(column.id, { type });
    setPending(false);
    if (!res.ok) console.error("change type failed", res.error);
  }

  async function onDelete() {
    setMenuOpen(false);
    if (!confirm(`Delete column "${column.name}"? Existing values stay in row data but become invisible.`)) return;
    setPending(true);
    const res = await deleteColumn(column.id);
    setPending(false);
    if (!res.ok) console.error("delete column failed", res.error);
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-muted uppercase tracking-wide",
        pending && "opacity-50",
      )}
    >
      <Type className="h-3 w-3 shrink-0 text-muted/60" />
      {renaming ? (
        <input
          autoFocus
          defaultValue={column.name}
          onBlur={(e) => commitRename(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitRename((e.currentTarget as HTMLInputElement).value);
            } else if (e.key === "Escape") {
              e.preventDefault();
              setRenaming(false);
            }
          }}
          className="flex-1 min-w-0 px-1 py-0.5 text-xs bg-white border border-teal/60 rounded outline-none focus:ring-2 focus:ring-teal/30"
        />
      ) : (
        <button
          type="button"
          onClick={() => setRenaming(true)}
          className="flex-1 min-w-0 truncate text-left hover:text-ink"
          title={column.name}
        >
          {column.name}
        </button>
      )}
      <span className="text-[10px] text-muted/60 normal-case">
        {COLUMN_TYPE_LABELS[column.type]}
      </span>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="p-0.5 rounded hover:bg-paper2"
          aria-label="Column options"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 mt-1 z-30 w-48 bg-white border border-line rounded-lg shadow-cardHover py-1">
            <button
              type="button"
              onClick={() => { setMenuOpen(false); setRenaming(true); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-ink hover:bg-paper2"
            >
              <Pencil className="h-3 w-3" /> Rename
            </button>
            <div className="border-t border-line my-1" />
            <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-muted">
              Change type
            </div>
            {TYPE_ORDER.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => changeType(t)}
                className={cn(
                  "w-full text-left px-3 py-1 text-xs hover:bg-paper2",
                  column.type === t ? "text-teal-600 font-medium" : "text-ink",
                )}
              >
                {COLUMN_TYPE_LABELS[t]}
              </button>
            ))}
            <div className="border-t border-line my-1" />
            <button
              type="button"
              onClick={onDelete}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-coral hover:bg-red-50"
            >
              <Trash2 className="h-3 w-3" /> Delete column
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
