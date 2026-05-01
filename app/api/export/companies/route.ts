import { NextResponse } from "next/server";
import { getCompanyList } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const companies = await getCompanyList();

  const headers = [
    "slug", "name", "sector", "country", "stage", "status",
    "invested_usd", "last_quarter", "arr_usd", "burn_usd", "cash_usd",
    "headcount", "revenue_usd", "last_update",
  ];

  const rows = companies.map((c) => {
    const last = c.metrics[c.metrics.length - 1];
    return [
      c.slug, c.name, c.sector ?? "", c.country ?? "", c.stage, c.status,
      c.invested,
      last?.quarter ?? "",
      last?.arr ?? "",
      last?.burn ?? "",
      last?.cash ?? "",
      last?.headcount ?? "",
      last?.revenue ?? "",
      c.lastUpdate,
    ];
  });

  const csv = [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pulso-companies-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
