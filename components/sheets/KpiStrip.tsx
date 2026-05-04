// L.10 / Fase 1.5 — KPI strip. Auto-rules per spec §7:
//   • Always show Row count.
//   • For the first numeric/currency/percent column, show Sum + Avg.
//   • For the first date column, show Last value (latest date) of the first
//     numeric column on that latest row.
// Rendered server-side from already-loaded rows so it costs nothing extra.

import { Card, CardBody } from "@/components/ui/card";
import { type SheetColumn, type SheetRow, formatValue } from "./types";

interface Props {
  columns: SheetColumn[];
  rows: SheetRow[];
}

export function KpiStrip({ columns, rows }: Props) {
  const numericCol = columns.find((c) =>
    c.type === "number" || c.type === "currency" || c.type === "percent",
  );
  const dateCol = columns.find((c) => c.type === "date");

  const kpis: { label: string; value: string }[] = [
    { label: "Rows", value: rows.length.toLocaleString("en-US") },
  ];

  if (numericCol) {
    const values = rows
      .map((r) => Number(r.data?.[numericCol.id]))
      .filter((n) => Number.isFinite(n));
    if (values.length > 0) {
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      kpis.push({
        label: `Sum · ${numericCol.name}`,
        value: formatValue(sum, numericCol),
      });
      kpis.push({
        label: `Avg · ${numericCol.name}`,
        value: formatValue(avg, numericCol),
      });
    }
  }

  if (dateCol && numericCol) {
    // Latest row by date. Falls back to natural row order if dates unparseable.
    const dated = rows
      .map((r) => ({ r, t: Date.parse(String(r.data?.[dateCol.id] ?? "")) }))
      .filter((x) => Number.isFinite(x.t));
    const latest = dated.length > 0
      ? dated.sort((a, b) => b.t - a.t)[0].r
      : rows[rows.length - 1];
    if (latest) {
      const v = latest.data?.[numericCol.id];
      if (v !== undefined && v !== null && v !== "") {
        kpis.push({
          label: `Last · ${numericCol.name}`,
          value: formatValue(v, numericCol),
        });
      }
    }
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {kpis.map((k) => (
        <Card key={k.label}>
          <CardBody className="p-4">
            <div className="text-[11px] uppercase tracking-wide text-muted">{k.label}</div>
            <div className="mt-1 text-xl font-serif text-ink truncate">{k.value}</div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
