"use client";

import { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useChartColor } from "@/lib/chart-color";

interface Props {
  data: Array<{ day: string; calls: number; cost_micro: number }>;
}

export function UsageChart({ data }: Props) {
  const { color, ref } = useChartColor("#14B8A6");

  const series = useMemo(
    () =>
      data.map((d) => ({
        day: new Date(d.day).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        cost: d.cost_micro / 1_000_000, // micro → USD
        calls: d.calls,
      })),
    [data],
  );

  if (series.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-[12px] text-muted">
        No data yet for the last 30 days.
      </div>
    );
  }

  return (
    <div ref={ref} className="h-[220px] w-full">
      <ResponsiveContainer>
        <BarChart data={series} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#eef0f4" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#7c849a" }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 10, fill: "#7c849a" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => (v < 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(1)}`)}
            width={48}
          />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e6e8ee" }}
            formatter={(value: number, name: string) => {
              if (name === "cost") return [`$${value.toFixed(4)}`, "Cost"];
              return [value, name];
            }}
          />
          <Bar dataKey="cost" radius={[4, 4, 0, 0]} fill={color} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
