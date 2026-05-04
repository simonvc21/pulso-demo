"use client";

// L.10 / Fase 1.5 — The main editable grid. CSS grid laid out by column count
// for a true tabular feel without the weight of a table-grid library.
// Row delete lives in a hover-revealed gutter on the right.

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteRow } from "@/app/(gp)/companies/[slug]/sheets/actions";
import { type SheetColumn, type SheetRow } from "./types";
import { SheetCell } from "./SheetCell";
import { SheetHeaderCell } from "./SheetHeaderCell";
import { AddColumnButton } from "./AddColumnButton";
import { AddRowButton } from "./AddRowButton";

interface Props {
  sheetId: string;
  columns: SheetColumn[];
  rows: SheetRow[];
}

export function SheetGrid({ sheetId, columns, rows }: Props) {
  if (columns.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-line p-8 text-center">
        <p className="text-sm text-muted mb-3">No columns yet — add one to get started.</p>
        <AddColumnButton sheetId={sheetId} />
      </div>
    );
  }

  // Numbered "#" gutter + each column + delete gutter. We rely on minmax so
  // long text doesn't crush the rest.
  const template = `48px ${columns.map(() => "minmax(140px, 1fr)").join(" ")} 40px`;

  return (
    <div className="bg-white rounded-xl border border-line overflow-x-auto shadow-card">
      <div className="min-w-max">
        {/* Header row */}
        <div
          className="grid border-b border-line bg-paper2/60 sticky top-0 z-10"
          style={{ gridTemplateColumns: template }}
        >
          <div className="px-2 py-1.5 text-xs font-medium text-muted">#</div>
          {columns.map((col) => (
            <div key={col.id} className="border-l border-line">
              <SheetHeaderCell column={col} />
            </div>
          ))}
          <div className="border-l border-line flex items-center justify-center">
            <AddColumnButton sheetId={sheetId} />
          </div>
        </div>

        {/* Body */}
        {rows.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted">
            No rows yet.
          </div>
        ) : (
          rows.map((row, idx) => (
            <Row
              key={row.id}
              row={row}
              idx={idx}
              columns={columns}
              template={template}
            />
          ))
        )}

        {/* Footer / add row */}
        <div
          className="grid border-t border-line bg-paper2/40"
          style={{ gridTemplateColumns: template }}
        >
          <div />
          <div className="col-span-full px-2 py-1">
            <AddRowButton sheetId={sheetId} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  row,
  idx,
  columns,
  template,
}: {
  row: SheetRow;
  idx: number;
  columns: SheetColumn[];
  template: string;
}) {
  const [pending, setPending] = useState(false);
  const [hovered, setHovered] = useState(false);

  async function onDelete() {
    if (!confirm("Delete this row?")) return;
    setPending(true);
    const res = await deleteRow(row.id);
    setPending(false);
    if (!res.ok) alert(res.error);
  }

  return (
    <div
      className={cn(
        "grid border-b border-line group hover:bg-paper2/30",
        pending && "opacity-50",
      )}
      style={{ gridTemplateColumns: template }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="px-2 py-1.5 text-xs text-muted/80 tabular-nums">
        {idx + 1}
      </div>
      {columns.map((col) => (
        <div
          key={col.id}
          className="border-l border-line min-h-[36px] flex items-center relative"
        >
          <SheetCell rowId={row.id} column={col} value={row.data?.[col.id]} />
        </div>
      ))}
      <div className="border-l border-line flex items-center justify-center">
        {hovered && (
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="p-1 rounded text-muted hover:text-coral hover:bg-red-50"
            aria-label="Delete row"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
