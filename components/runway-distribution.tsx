"use client";

// L.6c — Runway distribution: how many companies fall in each runway bucket.
// Color-coded: red (<6mo), gold (6-12mo), teal (>12mo).

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface CompanyShape {
  name: string;
  metrics: Array<{ cash: number; burn: number }>;
}

const BUCKETS = [
  { label: "< 6 mo", min: 0, max: 6, color: "#EF4444" },
  { label: "6-12 mo", min: 6, max: 12, color: "#F4B740" },
  { label: "12-18 mo", min: 12, max: 18, color: "#3B82F6" },
  { label: "18-24 mo", min: 18, max: 24, color: "#0D9488" },
  { label: "24+ mo", min: 24, max: Infinity, color: "#14B8A6" },
];

export function RunwayDistribution({ companies }: { companies: CompanyShape[] }) {
  const counts = BUCKETS.map((b) => ({ ...b, count: 0, names: [] as string[] }));
  for (const c of companies) {
    const last = c.metrics[c.metrics.length - 1];
    if (!last || !last.burn || last.burn <= 0) continue;
    const runway = last.cash / last.burn;
    const bucket = counts.find((b) => runway >= b.min && runway < b.max);
    if (bucket) {
      bucket.count += 1;
      bucket.names.push(c.name);
    }
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={counts} margin={{ top: 16, right: 12, left: 4, bottom: 0 }}>
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
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid rgb(var(--c-line))", background: "rgb(var(--c-paper))" }}
            formatter={(v: number, _: string, p: any) => [`${v} ${v === 1 ? "company" : "companies"}`, p.payload.label]}
            labelFormatter={(_, payload) => {
              const names = payload?.[0]?.payload?.names ?? [];
              return names.length > 0 ? names.join(", ") : "—";
            }}
            cursor={{ fill: "rgb(var(--c-paper2))" }}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {counts.map((b, i) => <Cell key={i} fill={b.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
