"use client";

// L.10 / Fase 1.5 — Auto-charted view of a sheet. Per spec §8 we pick:
//   • X axis: first date column, else first single_select, else first text col
//   • Y axis: first numeric/currency/percent column
//   • Type:   line if X is date, bar otherwise
// User can override via ChartConfigModal — overrides are local-state only in
// Fase 1 (no persistence yet). Spec §11.

import { useMemo, useState } from "react";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Settings2 } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { type SheetColumn, type SheetRow, formatValue } from "./types";
import { ChartConfigModal, type ChartConfig } from "./ChartConfigModal";

interface Props {
  columns: SheetColumn[];
  rows: SheetRow[];
  /** Distinguishes the two charts on the page. */
  index: 0 | 1;
}

export function SheetChart({ columns, rows, index }: Props) {
  const auto = useMemo(() => autoConfig(columns, index), [columns, index]);
  const [config, setConfig] = useState<ChartConfig | null>(auto);
  const [editing, setEditing] = useState(false);

  if (!config) {
    return (
      <Card>
        <CardBody className="p-4">
          <div className="text-xs text-muted">
            Need at least one numeric column and one X-axis column to render a chart.
          </div>
        </CardBody>
      </Card>
    );
  }

  const xCol = columns.find((c) => c.id === config.xColumnId);
  const yCol = columns.find((c) => c.id === config.yColumnId);

  if (!xCol || !yCol) {
    return (
      <Card>
        <CardBody className="p-4 text-xs text-muted">
          Selected column was deleted — pick a new one.
        </CardBody>
      </Card>
    );
  }

  const data = rows
    .map((r) => {
      const rawX = r.data?.[xCol.id];
      const rawY = r.data?.[yCol.id];
      const y = Number(rawY);
      if (!Number.isFinite(y)) return null;
      const xLabel = formatValue(rawX, xCol) || "—";
      const xSort = xCol.type === "date" ? Date.parse(String(rawX ?? "")) : 0;
      return { x: xLabel, y, xSort };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  if (xCol.type === "date") data.sort((a, b) => a.xSort - b.xSort);

  return (
    <Card>
      <CardBody className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">
              {config.type === "line" ? "Trend" : "Comparison"}
            </div>
            <div className="text-sm font-serif text-ink">
              {yCol.name} <span className="text-muted">by</span> {xCol.name}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="p-1.5 rounded text-muted hover:text-ink hover:bg-paper2"
            aria-label="Configure chart"
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </div>
        {data.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-xs text-muted">
            No data to plot.
          </div>
        ) : (
          <div className="h-[200px] w-full">
            <ResponsiveContainer>
              {config.type === "line" ? (
                <LineChart data={data} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#94A3B8" vertical={false} />
                  <XAxis dataKey="x" stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={{ stroke: "#DDE3EC" }} />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatTickValue(v, yCol)}
                  />
                  <Tooltip
                    cursor={{ stroke: "#14B8A6", strokeWidth: 1, strokeDasharray: "2 4" }}
                    contentStyle={{ background: "#0A1F44", border: "none", borderRadius: 8, color: "white", fontSize: 12, padding: "8px 12px" }}
                    labelStyle={{ color: "#F4B740", fontWeight: 600 }}
                    formatter={(v: number) => [formatValue(v, yCol), yCol.name]}
                  />
                  <Line type="monotone" dataKey="y" stroke="#14B8A6" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              ) : (
                <BarChart data={data} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#94A3B8" vertical={false} />
                  <XAxis dataKey="x" stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={{ stroke: "#DDE3EC" }} />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatTickValue(v, yCol)}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(20, 184, 166, 0.08)" }}
                    contentStyle={{ background: "#0A1F44", border: "none", borderRadius: 8, color: "white", fontSize: 12, padding: "8px 12px" }}
                    labelStyle={{ color: "#F4B740", fontWeight: 600 }}
                    formatter={(v: number) => [formatValue(v, yCol), yCol.name]}
                  />
                  <Bar dataKey="y" fill="#14B8A6" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </CardBody>
      {editing && (
        <ChartConfigModal
          columns={columns}
          value={config}
          onSave={(next) => { setConfig(next); setEditing(false); }}
          onClose={() => setEditing(false)}
        />
      )}
    </Card>
  );
}

// Compact tick formatter — same column-aware rules as formatValue but with
// $1.2M / 12K-style compaction for big numbers so axes don't blow up.
function formatTickValue(v: number, col: SheetColumn): string {
  if (col.type === "currency" || col.type === "number") {
    const prefix = col.type === "currency" ? "$" : "";
    if (Math.abs(v) >= 1_000_000) return `${prefix}${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return `${prefix}${(v / 1_000).toFixed(0)}K`;
    return `${prefix}${v}`;
  }
  if (col.type === "percent") {
    const pct = Math.abs(v) <= 1.0001 ? v * 100 : v;
    return `${pct.toFixed(0)}%`;
  }
  return String(v);
}

// ---------------------------------------------------------------------------
// Auto-pick logic. index=1 advances the Y-axis pick by one numeric column so
// the two charts on the page show different metrics by default.
function autoConfig(columns: SheetColumn[], index: 0 | 1): ChartConfig | null {
  const numericCols = columns.filter((c) =>
    c.type === "number" || c.type === "currency" || c.type === "percent",
  );
  const xCol =
    columns.find((c) => c.type === "date") ??
    columns.find((c) => c.type === "single_select") ??
    columns.find((c) => c.type === "text");
  const yCol = numericCols[index] ?? numericCols[0];
  if (!xCol || !yCol) return null;
  return {
    type: xCol.type === "date" ? "line" : "bar",
    xColumnId: xCol.id,
    yColumnId: yCol.id,
  };
}
