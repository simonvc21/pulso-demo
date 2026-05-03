"use client";

import { LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { QuarterMetric } from "@/lib/types";

interface Props {
  metrics: QuarterMetric[];
  metric: "arr" | "burn" | "cash" | "headcount" | "revenue";
  color: string;
}

const labels: Record<Props["metric"], string> = {
  arr: "ARR",
  burn: "Monthly burn",
  cash: "Cash on hand",
  headcount: "Headcount",
  revenue: "Quarterly revenue",
};

export function CompanyHistoryChart({ metrics, metric, color }: Props) {
  const data = metrics.map((m) => ({
    quarter: m.quarter,
    value: ["arr", "burn", "cash", "revenue"].includes(metric) ? m[metric] / 1_000_000 : m[metric],
  }));
  const formatter = (v: number) =>
    metric === "headcount" ? `${Math.round(v)} FTE` : `$${v.toFixed(1)}M`;

  return (
    <div className="h-[180px] w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 12, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="#94A3B8" vertical={false} />
          <XAxis dataKey="quarter" stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={{ stroke: "#DDE3EC" }} />
          <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: "2 4" }}
            contentStyle={{ background: "#0A1F44", border: "none", borderRadius: 8, color: "white", fontSize: 12, padding: "6px 10px" }}
            labelStyle={{ color: "#F4B740", fontSize: 11, fontWeight: 600 }}
            formatter={(v: number) => [formatter(v), labels[metric]]}
          />
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#grad-${metric})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
