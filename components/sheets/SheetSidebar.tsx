"use client";

// L.10 / Fase 1.5 — Per-company sidebar listing the company's sheets.
// Selected sheet gets a teal accent. New / rename / delete live here so they
// don't crowd the main view.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createSheet,
  renameSheet,
  deleteSheet,
} from "@/app/(gp)/companies/[slug]/sheets/actions";
import { type Sheet } from "./types";

interface Props {
  companyId: string;
  companySlug: string;
  sheets: Sheet[];
  activeSheetId: string | null;
}

export function SheetSidebar({ companyId, companySlug, sheets, activeSheetId }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [pending, setPending] = useState(false);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setPending(true);
    const res = await createSheet(companyId, newName.trim());
    setPending(false);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    setNewName("");
    setCreating(false);
    router.push(`/companies/${res.data.companySlug}/sheets/${res.data.id}`);
  }

  return (
    <aside className="w-56 shrink-0 border-r border-line bg-paper2/30">
      <div className="px-3 py-3 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-muted font-medium">
          Sheets
        </span>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="p-1 rounded hover:bg-paper2 text-muted hover:text-ink"
          aria-label="New sheet"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {creating && (
        <form onSubmit={onCreate} className="px-3 pb-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={() => { if (!newName.trim()) setCreating(false); }}
            onKeyDown={(e) => { if (e.key === "Escape") setCreating(false); }}
            placeholder="Sheet name"
            className="w-full px-2 py-1 text-sm border border-line rounded focus:border-teal/60 focus:ring-2 focus:ring-teal/20 outline-none"
            disabled={pending}
          />
        </form>
      )}

      <nav className="px-2 pb-3 space-y-0.5">
        {sheets.length === 0 && !creating && (
          <p className="px-2 py-1 text-xs text-muted">
            No sheets yet.
          </p>
        )}
        {sheets.map((s) => (
          <SheetRow
            key={s.id}
            sheet={s}
            active={s.id === activeSheetId}
            companySlug={companySlug}
          />
        ))}
      </nav>
    </aside>
  );
}

function SheetRow({
  sheet,
  active,
  companySlug,
}: {
  sheet: Sheet;
  active: boolean;
  companySlug: string;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [pending, setPending] = useState(false);

  async function onRename(name: string) {
    const trimmed = name.trim();
    setRenaming(false);
    if (!trimmed || trimmed === sheet.name) return;
    setPending(true);
    const res = await renameSheet(sheet.id, trimmed);
    setPending(false);
    if (!res.ok) alert(res.error);
  }

  async function onDelete() {
    setMenuOpen(false);
    if (!confirm(`Delete sheet "${sheet.name}"? This removes all rows and columns.`)) return;
    setPending(true);
    const res = await deleteSheet(sheet.id);
    setPending(false);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    if (active) router.push(`/companies/${companySlug}`);
  }

  if (renaming) {
    return (
      <div className="px-2">
        <input
          autoFocus
          defaultValue={sheet.name}
          onBlur={(e) => onRename(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onRename((e.currentTarget as HTMLInputElement).value);
            } else if (e.key === "Escape") {
              setRenaming(false);
            }
          }}
          className="w-full px-2 py-1 text-sm border border-teal/60 rounded outline-none"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-md",
        active ? "bg-teal-50" : "hover:bg-paper2",
        pending && "opacity-50",
      )}
    >
      <Link
        href={`/companies/${companySlug}/sheets/${sheet.id}`}
        className={cn(
          "flex-1 min-w-0 truncate px-2 py-1.5 text-sm",
          active ? "text-teal-600 font-medium" : "text-ink",
        )}
      >
        {sheet.name}
      </Link>
      <div className="relative pr-1">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="p-1 rounded text-muted hover:text-ink hover:bg-white opacity-0 group-hover:opacity-100"
          aria-label="Sheet options"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
        {menuOpen && (
          <div
            className="absolute right-0 top-full mt-1 z-30 w-40 bg-white border border-line rounded-lg shadow-cardHover py-1"
            onMouseLeave={() => setMenuOpen(false)}
          >
            <button
              type="button"
              onClick={() => { setMenuOpen(false); setRenaming(true); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-ink hover:bg-paper2"
            >
              <Pencil className="h-3 w-3" /> Rename
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-coral hover:bg-red-50"
            >
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
