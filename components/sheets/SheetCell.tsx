"use client";

// L.10 / Fase 1.5 — Per-type cell editor. Click to edit, blur/Enter to save.
// One component dispatches by column.type so the grid stays type-agnostic.

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { updateRow } from "@/app/(gp)/companies/[slug]/sheets/actions";
import {
  type SheetColumn,
  formatValue,
  parseCellInput,
  SELECT_COLORS,
} from "./types";

interface Props {
  rowId: string;
  column: SheetColumn;
  value: any;
}

export function SheetCell({ rowId, column, value }: Props) {
  const [editing, setEditing] = useState(false);
  const [optimistic, setOptimistic] = useState<any>(value);
  const [pending, setPending] = useState(false);

  // Re-sync from server when the prop changes (e.g. after revalidatePath).
  useEffect(() => {
    setOptimistic(value);
  }, [value]);

  async function save(next: any) {
    if (next === optimistic) {
      setEditing(false);
      return;
    }
    setOptimistic(next);
    setEditing(false);
    setPending(true);
    const res = await updateRow(rowId, { [column.id]: next });
    setPending(false);
    if (!res.ok) {
      // Revert on failure.
      setOptimistic(value);
      console.error("updateRow failed", res.error);
    }
  }

  // Checkbox toggles inline — no edit state needed.
  if (column.type === "checkbox") {
    return (
      <label className="flex items-center justify-center w-full h-full cursor-pointer">
        <input
          type="checkbox"
          checked={!!optimistic}
          onChange={(e) => save(e.target.checked)}
          disabled={pending}
          className="h-4 w-4 rounded border-line text-teal focus:ring-teal/40"
        />
      </label>
    );
  }

  // Single-select renders a chip; clicking opens the option picker.
  if (column.type === "single_select") {
    const options = column.config.options ?? [];
    if (editing) {
      return (
        <SelectPicker
          options={options}
          value={optimistic}
          onPick={(next) => save(next)}
          onCancel={() => setEditing(false)}
        />
      );
    }
    const opt = options.find((o) => o.id === optimistic || o.label === optimistic);
    const colorKey = opt?.color ?? "muted";
    const palette = SELECT_COLORS[colorKey] ?? SELECT_COLORS.muted;
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-full h-full text-left px-2 py-1"
      >
        {opt ? (
          <span
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border",
              palette.bg,
              palette.text,
              palette.border,
            )}
          >
            {opt.label}
          </span>
        ) : (
          <span className="text-muted text-xs">—</span>
        )}
      </button>
    );
  }

  // Long-text gets a textarea; everything else gets a plain input.
  if (editing) {
    return column.type === "long_text" ? (
      <TextareaEditor
        initial={optimistic ?? ""}
        onCommit={save}
        onCancel={() => setEditing(false)}
      />
    ) : (
      <InputEditor
        column={column}
        initial={optimistic}
        onCommit={save}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const display = formatValue(optimistic, column);
  const isUrl = column.type === "attachment_url" && !!display;

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        "w-full h-full text-left px-2 py-1 truncate",
        pending && "opacity-50",
      )}
    >
      {isUrl ? (
        <a
          href={display}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-teal-600 hover:underline"
        >
          {display}
        </a>
      ) : display ? (
        <span className="text-sm text-ink">{display}</span>
      ) : (
        <span className="text-xs text-muted">—</span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------

function InputEditor({
  column,
  initial,
  onCommit,
  onCancel,
}: {
  column: SheetColumn;
  initial: any;
  onCommit: (v: any) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const inputType =
    column.type === "date"
      ? "date"
      : column.type === "number" || column.type === "currency" || column.type === "percent"
      ? "number"
      : column.type === "attachment_url"
      ? "url"
      : "text";

  const initialStr =
    initial === null || initial === undefined
      ? ""
      : column.type === "percent" && typeof initial === "number"
      ? // Stored 0..1 → display 0..100 in the editor.
        (Math.abs(initial) <= 1.0001 ? initial * 100 : initial).toString()
      : String(initial);

  return (
    <input
      ref={ref}
      type={inputType}
      step={inputType === "number" ? "any" : undefined}
      defaultValue={initialStr}
      onBlur={(e) => onCommit(parseCellInput(e.currentTarget.value, column))}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onCommit(parseCellInput(e.currentTarget.value, column));
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      className="w-full h-full px-2 py-1 text-sm text-ink bg-white border border-teal/60 rounded outline-none focus:ring-2 focus:ring-teal/30"
    />
  );
}

function TextareaEditor({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (v: any) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <textarea
      ref={ref}
      defaultValue={initial}
      rows={3}
      onBlur={(e) => onCommit(e.currentTarget.value.trim() || null)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          onCommit(e.currentTarget.value.trim() || null);
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      className="w-full px-2 py-1 text-sm text-ink bg-white border border-teal/60 rounded outline-none focus:ring-2 focus:ring-teal/30 resize-none"
    />
  );
}

function SelectPicker({
  options,
  value,
  onPick,
  onCancel,
}: {
  options: { id: string; label: string; color?: string }[];
  value: any;
  onPick: (id: string | null) => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="absolute z-20 mt-1 min-w-[10rem] bg-white border border-line rounded-lg shadow-card p-1"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) onCancel();
      }}
      tabIndex={-1}
    >
      <button
        type="button"
        onClick={() => onPick(null)}
        className="w-full text-left px-2 py-1 text-xs text-muted rounded hover:bg-paper2"
      >
        Clear
      </button>
      {options.map((o) => {
        const palette = SELECT_COLORS[o.color ?? "muted"] ?? SELECT_COLORS.muted;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onPick(o.id)}
            className={cn(
              "w-full text-left px-2 py-1 text-xs rounded hover:bg-paper2",
              value === o.id && "bg-paper2",
            )}
          >
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-md font-medium border",
                palette.bg,
                palette.text,
                palette.border,
              )}
            >
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
