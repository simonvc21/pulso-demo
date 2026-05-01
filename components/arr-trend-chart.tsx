"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { companies } from "@/lib/mock-data";

export function ArrTrendChart() {
  // Build a stacked series: {quarter, totalARR}
  const quarters = companies[0].metrics.map((m) => m.quarter);
  const data = quarters.map((q, i) => ({
    quarter: q,
    arr: companies.reduce((a, c) => a + c.metrics[i].arr, 0) / 1_000_000,
  }));

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 14, right: 12, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="arrGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#14B8A6" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#14B8A6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="#DDE3EC" vertical={false} />
          <XAxis dataKey="quarter" stroke="#64748B" fontSize={10} tickLine={false} axisLine={{ stroke: "#DDE3EC" }} />
          <YAxis
            stroke="#64748B"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${v}M`}
          />
          <Tooltip
            cursor={{ stroke: "#14B8A6", strokeWidth: 1, strokeDasharray: "2 4" }}
            contentStyle={{ background: "#0A1F44", border: "none", borderRadius: 8, color: "white", fontSize: 12, padding: "8px 12px" }}
            labelStyle={{ color: "#F4B740", fontWeight: 600 }}
            formatter={(v: number) => [`$${v.toFixed(1)}M total ARR`, ""]}
          />
          <Area type="monotone" dataKey="arr" stroke="#14B8A6" strokeWidth={2} fill="url(#arrGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
