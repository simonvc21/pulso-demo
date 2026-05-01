"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { Company } from "@/lib/types";

const statusColor: Record<string, string> = {
  healthy: "#14B8A6",
  watch: "#F4B740",
  critical: "#EF4444",
  "no-data": "#94A3B8",
};

export function PortfolioBarChart({ companies }: { companies: Company[] }) {
  const data = [...companies]
    .sort((a, b) => b.metrics[b.metrics.length - 1].arr - a.metrics[a.metrics.length - 1].arr)
    .map((c) => ({
      name: c.name,
      arr: c.metrics[c.metrics.length - 1].arr / 1_000_000,
      status: c.status,
    }));

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 14, right: 8, left: -14, bottom: 0 }}>
          <XAxis
            dataKey="name"
            stroke="#64748B"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: "#DDE3EC" }}
          />
          <YAxis
            stroke="#64748B"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${v}M`}
          />
          <Tooltip
            cursor={{ fill: "rgba(20,184,166,0.06)" }}
            contentStyle={{
              background: "#0A1F44",
              border: "none",
              borderRadius: 8,
              color: "white",
              fontSize: 12,
              padding: "8px 12px",
            }}
            labelStyle={{ color: "#F4B740", fontWeight: 600 }}
            itemStyle={{ color: "white" }}
            formatter={(v: number) => [`$${v.toFixed(1)}M ARR`, ""]}
          />
          <Bar dataKey="arr" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={statusColor[d.status] || "#14B8A6"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
