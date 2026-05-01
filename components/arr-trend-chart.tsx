"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export interface ArrTrendPoint {
  quarter: string;
  arr: number; // USD
}

export function ArrTrendChart({ data }: { data: ArrTrendPoint[] }) {
  const series = data.map((p) => ({ quarter: p.quarter, arr: p.arr / 1_000_000 }));

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer>
        <AreaChart data={series} margin={{ top: 14, right: 12, left: -10, bottom: 0 }}>
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
