"use client";

// L.10 / Fase 1.5 — Chart configuration. Local state only in Fase 1; not
// persisted yet (spec §11). Picks chart type + X/Y columns.

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { type SheetColumn, COLUMN_TYPE_LABELS } from "./types";

export type ChartType = "bar" | "line";

export interface ChartConfig {
  type: ChartType;
  xColumnId: string;
  yColumnId: string;
}

interface Props {
  columns: SheetColumn[];
  value: ChartConfig;
  onSave: (next: ChartConfig) => void;
  onClose: () => void;
}

export function ChartConfigModal({ columns, value, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<ChartConfig>(value);

  const numericCols = columns.filter((c) =>
    c.type === "number" || c.type === "currency" || c.type === "percent",
  );
  const xCols = columns.filter((c) =>
    c.type === "date" || c.type === "single_select" ||
    c.type === "text" || c.type === "long_text",
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl border border-line shadow-cardHover w-full max-w-md p-5 m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-lg text-ink">Configure chart</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-paper2 text-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted mb-1.5">Type</div>
            <div className="grid grid-cols-2 gap-2">
              {(["bar", "line"] as ChartType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDraft({ ...draft, type: t })}
                  className={cn(
                    "px-3 py-2 text-sm rounded border capitalize",
                    draft.type === t
                      ? "border-teal/60 bg-teal-50 text-teal-600"
                      : "border-line text-ink hover:bg-paper2",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wide text-muted mb-1.5">
              X axis
            </label>
            <select
              value={draft.xColumnId}
              onChange={(e) => setDraft({ ...draft, xColumnId: e.target.value })}
              className="w-full px-2 py-1.5 text-sm border border-line rounded focus:border-teal/60 focus:ring-2 focus:ring-teal/20 outline-none"
            >
              {xCols.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {COLUMN_TYPE_LABELS[c.type]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wide text-muted mb-1.5">
              Y axis
            </label>
            <select
              value={draft.yColumnId}
              onChange={(e) => setDraft({ ...draft, yColumnId: e.target.value })}
              className="w-full px-2 py-1.5 text-sm border border-line rounded focus:border-teal/60 focus:ring-2 focus:ring-teal/20 outline-none"
            >
              {numericCols.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {COLUMN_TYPE_LABELS[c.type]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-line">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            disabled={!draft.xColumnId || !draft.yColumnId}
            className="px-4 py-2 text-sm font-medium bg-navy text-white rounded hover:bg-navy-700 disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
