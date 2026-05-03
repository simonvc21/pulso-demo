"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

interface Props {
  data: Array<{ quarter: string; value: number | null }>;
  color?: string;
  unit?: string | null;
}

export function CustomMetricChart({ data, color = "#14B8A6", unit }: Props) {
  // Filter out nulls so the line draws cleanly across gaps.
  const points = data
    .filter((d) => d.value != null)
    .map((d) => ({ quarter: d.quarter, value: d.value as number }));

  if (points.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-[11px] text-muted">
        No values yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={points} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#eef0f4" vertical={false} />
        <XAxis dataKey="quarter" tick={{ fontSize: 10, fill: "#7c849a" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "#7c849a" }} axisLine={false} tickLine={false} width={36} />
        <Tooltip
          contentStyle={{ fontSize: "11px", borderRadius: 6, border: "1px solid #e6e8ee" }}
          formatter={(v: number) => [`${v.toLocaleString("en-US")}${unit ? " " + unit : ""}`, "Value"]}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={{ r: 3, stroke: color, strokeWidth: 1.5, fill: "white" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
