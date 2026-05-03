"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MessageSquare, Loader2, Check, X, Trash2 } from "lucide-react";
import type { DataMetricKey } from "@/lib/data-metrics";
import { upsertMetricNote, deleteMetricNote } from "./actions";
import { Button } from "@/components/ui/button";

interface Props {
  companyId: string;
  companyName: string;
  quarter: string;
  metricKey: DataMetricKey;
  metricLabel: string;
  initialNote: string;
  anchorRect: DOMRect;
  onClose: () => void;
  onSaved: (note: string) => void;
  onDeleted: () => void;
}

export function CellNotePopover({
  companyId, companyName, quarter, metricKey, metricLabel,
  initialNote, anchorRect, onClose, onSaved, onDeleted,
}: Props) {
  const [draft, setDraft] = useState(initialNote);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  // Click-outside to close
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    // Defer one tick so the opening click doesn't immediately close it.
    const t = setTimeout(() => document.addEventListener("mousedown", onDoc), 0);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", onDoc); };
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      // Empty save → delete (if it was previously set) or close
      if (initialNote) handleDelete();
      else onClose();
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await upsertMetricNote({ companyId, quarter, metricKey, note: trimmed });
      if (!res.ok) { setError(res.error); return; }
      onSaved(trimmed);
      onClose();
    });
  };

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      const res = await deleteMetricNote({ companyId, quarter, metricKey });
      if (!res.ok) { setError(res.error); return; }
      onDeleted();
      onClose();
    });
  };

  if (typeof document === "undefined") return null;

  // Position: prefer below the anchor; flip up if not enough room.
  const POPOVER_W = 320;
  const POPOVER_H_ESTIMATE = 220;
  const margin = 8;
  let left = anchorRect.left;
  let top = anchorRect.bottom + margin;
  if (left + POPOVER_W > window.innerWidth - 12) {
    left = window.innerWidth - POPOVER_W - 12;
  }
  if (left < 12) left = 12;
  if (top + POPOVER_H_ESTIMATE > window.innerHeight - 12) {
    top = Math.max(12, anchorRect.top - POPOVER_H_ESTIMATE - margin);
  }

  return createPortal(
    <div
      ref={ref}
      style={{ left, top }}
      className="fixed w-80 bg-white rounded-lg border border-line shadow-cardHover z-50 animate-fade-in"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-line">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-ink truncate">
            {companyName} · {quarter}
          </div>
          <div className="text-[10px] text-muted">{metricLabel}</div>
        </div>
        <button onClick={onClose} className="text-muted hover:text-ink shrink-0 ml-2">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="px-3 py-2.5">
        <label className="block text-[10px] font-semibold text-muted tracking-[0.14em] uppercase mb-1">
          <MessageSquare className="h-3 w-3 inline -mt-0.5 mr-1" /> Note
        </label>
        <textarea
          autoFocus
          rows={4}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={2000}
          placeholder="Why did this cell move? What's the story?"
          className="w-full px-2 py-1.5 rounded-md border border-line text-[12px] focus:outline-none focus:ring-2 focus:ring-teal/30 resize-none"
          onKeyDown={(e) => {
            if ((e.key === "Enter" && (e.metaKey || e.ctrlKey)) || e.key === "Escape") {
              e.preventDefault();
              if (e.key === "Enter") save();
              else onClose();
            }
          }}
        />
        <div className="mt-1 text-[10px] text-muted text-right">
          {draft.length} / 2000 · ⌘↵ to save
        </div>
      </div>

      {error && (
        <div className="px-3 pb-2 text-[11px] text-coral">{error}</div>
      )}

      <div className="px-3 py-2 border-t border-line flex items-center justify-between">
        {initialNote ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="text-[11px] text-coral hover:underline inline-flex items-center gap-1 disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" /> Delete
          </button>
        ) : <span />}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="gold" size="sm" className="gap-1.5" onClick={save} disabled={pending}>
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Save
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
