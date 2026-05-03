import { NextResponse, type NextRequest } from "next/server";
import { getDataMatrix, DATA_METRICS, quarterKey } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(_request: NextRequest) {
  const matrix = await getDataMatrix();

  // Long format: one row per (company, quarter) with all metric columns.
  const headers = [
    "company_slug",
    "company_name",
    "sector",
    "country",
    "stage",
    "status",
    "quarter",
    ...DATA_METRICS.map((m) => m.key),
  ];

  const rows: (string | number | null)[][] = [];
  for (const c of matrix.companies) {
    const presentQuarters = Object.keys(c.metrics).sort((a, b) => quarterKey(a) - quarterKey(b));
    if (presentQuarters.length === 0) {
      rows.push([c.slug, c.name, c.sector, c.country, c.stage, c.status, "", ...DATA_METRICS.map(() => null)]);
      continue;
    }
    for (const q of presentQuarters) {
      rows.push([
        c.slug, c.name, c.sector, c.country, c.stage, c.status, q,
        ...DATA_METRICS.map((m) => c.metrics[q]?.[m.key as (typeof DATA_METRICS)[number]["key"]] ?? null),
      ]);
    }
  }

  const csv = [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pulso-metrics-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
