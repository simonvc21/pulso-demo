import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
type MetricRow = Database["public"]["Tables"]["metrics"]["Row"];
type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];

export interface DashboardMetric {
  quarter: string;
  arr: number;
  burn: number;
  cash: number;
  headcount: number;
  revenue: number;
}

export interface DashboardCompany {
  id: string;
  slug: string;
  name: string;
  status: "healthy" | "watch" | "critical" | "no-data";
  flag: string | null;
  metrics: DashboardMetric[];
}

export interface DashboardKpis {
  arrTotal: number;
  arrPrev: number;
  qoqArrGrowth: number;
  yoyGrowth: number;
  cash: number;
  burn: number;
  headcount: number;
  runwayMonths: number;
}

export interface DashboardData {
  organization: Pick<OrganizationRow, "id" | "name" | "size_usd" | "deployed_usd" | "vintage" | "currency"> | null;
  companies: DashboardCompany[];
  kpis: DashboardKpis;
  arrTrend: { quarter: string; arr: number }[];
  watchList: DashboardCompany[];
}

// Quarter strings sort lexicographically wrong ("Q4 2025" > "Q1 2026"),
// so convert to sortable (year, quarter-number) pair.
function quarterSortKey(q: string): number {
  const m = /^Q(\d)\s+(\d{4})$/.exec(q.trim());
  if (!m) return 0;
  const qn = parseInt(m[1], 10);
  const yr = parseInt(m[2], 10);
  return yr * 10 + qn;
}

function normalizeStatus(s: CompanyRow["status"]): DashboardCompany["status"] {
  return s === "no_data" ? "no-data" : s;
}

function num(n: number | null | undefined): number {
  return n == null ? 0 : Number(n);
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = createClient();

  // RLS scopes both queries to the caller's organization.
  const [{ data: orgs }, { data: companyRows }] = await Promise.all([
    supabase.from("organizations").select("id, name, size_usd, deployed_usd, vintage, currency").limit(1),
    supabase
      .from("companies")
      .select("id, slug, name, status, flag, metrics(quarter, arr_usd, burn_usd, cash_usd, headcount, revenue_usd)")
      .order("name", { ascending: true }),
  ]);

  const organization = orgs?.[0] ?? null;

  const companies: DashboardCompany[] = (companyRows ?? []).map((c: any) => {
    const metrics: DashboardMetric[] = (c.metrics ?? [])
      .map((m: MetricRow) => ({
        quarter: m.quarter,
        arr: num(m.arr_usd),
        burn: num(m.burn_usd),
        cash: num(m.cash_usd),
        headcount: num(m.headcount),
        revenue: num(m.revenue_usd),
      }))
      .sort((a: DashboardMetric, b: DashboardMetric) => quarterSortKey(a.quarter) - quarterSortKey(b.quarter));

    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      status: normalizeStatus(c.status),
      flag: c.flag,
      metrics,
    };
  });

  const kpis = computeKpis(companies);
  const arrTrend = computeArrTrend(companies);
  const watchList = companies
    .filter((c) => c.status === "critical" || c.status === "watch")
    .sort((a, b) => (a.status === "critical" ? -1 : 1));

  return { organization, companies, kpis, arrTrend, watchList };
}

function computeKpis(companies: DashboardCompany[]): DashboardKpis {
  const latest = (c: DashboardCompany) => c.metrics[c.metrics.length - 1];
  const prev = (c: DashboardCompany) => c.metrics[c.metrics.length - 2];
  const yoy = (c: DashboardCompany) => c.metrics[c.metrics.length - 5];

  const arrTotal = companies.reduce((a, c) => a + (latest(c)?.arr ?? 0), 0);
  const arrPrev = companies.reduce((a, c) => a + (prev(c)?.arr ?? 0), 0);
  const arrYoY = companies.reduce((a, c) => a + (yoy(c)?.arr ?? 0), 0);
  const cash = companies.reduce((a, c) => a + (latest(c)?.cash ?? 0), 0);
  const burn = companies.reduce((a, c) => a + (latest(c)?.burn ?? 0), 0);
  const headcount = companies.reduce((a, c) => a + (latest(c)?.headcount ?? 0), 0);

  const yoyGrowth = arrYoY > 0 ? ((arrTotal - arrYoY) / arrYoY) * 100 : 0;
  const runwayMonths = burn > 0 ? cash / burn : 0;
  const qoqArrGrowth = arrPrev > 0 ? ((arrTotal - arrPrev) / arrPrev) * 100 : 0;

  return { arrTotal, arrPrev, qoqArrGrowth, yoyGrowth, cash, burn, headcount, runwayMonths };
}

function computeArrTrend(companies: DashboardCompany[]): { quarter: string; arr: number }[] {
  const buckets = new Map<string, number>();
  for (const c of companies) {
    for (const m of c.metrics) {
      buckets.set(m.quarter, (buckets.get(m.quarter) ?? 0) + m.arr);
    }
  }
  return Array.from(buckets.entries())
    .sort((a, b) => quarterSortKey(a[0]) - quarterSortKey(b[0]))
    .map(([quarter, arr]) => ({ quarter, arr }));
}
