"use client";

// L.6c — Generic per-company bar chart for any standard metric.
// Same shape as PortfolioBarChart (which is ARR-only) but for cash, burn,
// revenue, headcount, or runway months.

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useChartColor } from "@/lib/chart-color";

export type MetricKey = "arr" | "cash" | "burn" | "revenue" | "headcount";

interface CompanyShape {
  name: string;
  status: "healthy" | "watch" | "critical" | "no-data";
  metrics: Array<{ arr: number; burn: number; cash: number; headcount: number; revenue: number }>;
}

interface Props {
  companies: CompanyShape[];
  metric: MetricKey;
  /** Display: divide by 1_000_000 for currency-style metrics, raw for headcount. */
  units?: "millions" | "raw" | "k_per_month";
  /** "x.xM" / "x.xK/mo" / raw integer formatter applied per tooltip. */
  formatValue?: (v: number) => string;
}

export function PortfolioMetricBarChart({ companies, metric, units = "millions", formatValue }: Props) {
  const { color: chartColor, ref } = useChartColor("#14B8A6");

  const statusColor: Record<string, string> = {
    healthy: chartColor,
    watch: "#F4B740",
    critical: "#EF4444",
    "no-data": "#94A3B8",
  };

  const data = [...companies]
    .map((c) => {
      const latest = c.metrics[c.metrics.length - 1];
      const raw = latest ? Number(latest[metric] ?? 0) : 0;
      let value = raw;
      if (units === "millions") value = raw / 1_000_000;
      if (units === "k_per_month") value = raw / 1_000;
      return { name: c.name, value, raw, status: c.status };
    })
    .sort((a, b) => b.value - a.value);

  const fmt = formatValue ?? ((v: number) => {
    if (units === "millions") return `$${v.toFixed(1)}M`;
    if (units === "k_per_month") return `$${v.toFixed(0)}K/mo`;
    return v.toLocaleString("en-US");
  });

  return (
    <div ref={ref} className="w-full">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 16, right: 12, left: 4, bottom: 0 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "rgb(var(--c-muted))" }}
            axisLine={{ stroke: "rgb(var(--c-line))" }}
            tickLine={false}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={50}
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
            cursor={{ fill: "rgb(var(--c-paper2))" }}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={statusColor[d.status]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
