"use client";

// L.9a — Pie + donut charts. Both use the same Recharts <PieChart>; the
// donut just sets innerRadius. Single component with an "inner" prop so
// callers don't have to pick which file to import.

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useChartColor } from "@/lib/chart-color";

export interface PieDatum {
  label: string;
  value: number;
}

interface Props {
  data: PieDatum[];
  /** When set (e.g. 60), renders as a donut with that inner radius. 0 = solid pie. */
  inner?: number;
  /** Format the tooltip value. Defaults to locale string. */
  formatValue?: (v: number) => string;
  /** Show a legend below the chart. */
  showLegend?: boolean;
  /** Override the palette. Otherwise auto-derives from the fund's chart color. */
  colors?: string[];
}

const DEFAULT_PALETTE = [
  "#14B8A6", // teal
  "#F4B740", // gold
  "#1B3A6F", // navy-light
  "#0A1F44", // navy
  "#E1654B", // coral
  "#7c849a", // muted slate
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#10B981", // emerald
];

export function PieChartCard({
  data,
  inner = 0,
  formatValue,
  showLegend = false,
  colors,
}: Props) {
  const { color: chartColor, ref } = useChartColor("#14B8A6");
  const palette = colors ?? DEFAULT_PALETTE;
  // First slice uses the fund's brand color so it feels themed.
  const themed = [chartColor, ...palette.slice(1)];

  const total = data.reduce((a, d) => a + d.value, 0);
  const fmt = formatValue ?? ((v: number) => v.toLocaleString("en-US"));

  return (
    <div ref={ref} className="w-full">
      <ResponsiveContainer width="100%" height={inner > 0 ? 240 : 220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={inner}
            outerRadius={inner > 0 ? 90 : 80}
            paddingAngle={2}
            stroke="rgb(var(--c-paper))"
            strokeWidth={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={themed[i % themed.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid rgb(var(--c-line))", background: "rgb(var(--c-paper))" }}
            formatter={(v: number, _name: string, p: any) => [
              `${fmt(v)} (${total > 0 ? ((v / total) * 100).toFixed(0) : 0}%)`,
              p.payload.label,
            ]}
          />
          {showLegend && (
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              wrapperStyle={{ fontSize: 11, color: "rgb(var(--c-muted))" }}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
