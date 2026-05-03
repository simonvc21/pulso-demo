"use client";

// L.6c — Generic aggregated trend chart for any metric across the portfolio.
// Sums the latest period's value per company across the trailing N periods.

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useChartColor } from "@/lib/chart-color";

interface TrendPoint {
  label: string;
  value: number;
}

interface Props {
  data: TrendPoint[];
  units?: "millions" | "k_per_month" | "raw";
  /** Override line color; otherwise uses the fund's brand chart color. */
  color?: string;
}

export function PortfolioTrendChart({ data, units = "millions", color }: Props) {
  const { color: themed, ref } = useChartColor("#14B8A6");
  const stroke = color ?? themed;

  const transformed = data.map((d) => {
    let v = d.value;
    if (units === "millions") v = d.value / 1_000_000;
    if (units === "k_per_month") v = d.value / 1_000;
    return { ...d, v };
  });

  const fmt = (v: number) => {
    if (units === "millions") return `$${v.toFixed(1)}M`;
    if (units === "k_per_month") return `$${v.toFixed(0)}K`;
    return v.toLocaleString("en-US");
  };

  return (
    <div ref={ref} className="w-full">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={transformed} margin={{ top: 16, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid stroke="rgb(var(--c-line))" strokeDasharray="2 2" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "rgb(var(--c-muted))" }}
            axisLine={{ stroke: "rgb(var(--c-line))" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "rgb(var(--c-muted))" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => {
              if (units === "millions") return `$${v}M`;
              if (units === "k_per_month") return `$${v}K`;
              return String(v);
            }}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid rgb(var(--c-line))", background: "rgb(var(--c-paper))" }}
            formatter={(v: number) => fmt(v)}
            cursor={{ stroke: "rgb(var(--c-line))" }}
          />
          <Line
            type="monotone"
            dataKey="v"
            stroke={stroke}
            strokeWidth={2.5}
            dot={{ r: 3, fill: stroke, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
