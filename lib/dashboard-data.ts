import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { formatPeriod, periodKey, type PeriodKind } from "@/lib/period";

type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];
type LpRow = Database["public"]["Tables"]["lps"]["Row"];

/** Convert a metrics row from the DB into the friendly period label used by
 *  the UI (`"Mar 2026"` for monthly, `"Q1 2026"` for quarterly). When
 *  period_year/period_month aren't set yet we fall back to the legacy
 *  `quarter` text column. */
function metricRowToLabel(m: { period_year?: number | null; period_month?: number | null; period_kind?: PeriodKind | null; quarter: string }): string {
  if (m.period_year && m.period_month && m.period_kind) {
    return formatPeriod({ year: m.period_year, month: m.period_month, kind: m.period_kind });
  }
  return m.quarter;
}

function metricRowSortKey(m: { period_year?: number | null; period_month?: number | null; period_kind?: PeriodKind | null }): number {
  if (m.period_year && m.period_month) {
    return periodKey({ year: m.period_year, month: m.period_month, kind: m.period_kind ?? "month" });
  }
  return 0;
}

export type FundSummary = Pick<
  OrganizationRow,
  "id" | "name" | "size_usd" | "deployed_usd" | "vintage" | "currency" | "logo_url" | "theme_json"
  | "description" | "thesis" | "website" | "linkedin_url" | "founded_year"
>;

export async function getFund(): Promise<FundSummary | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("organizations")
    .select("id, name, size_usd, deployed_usd, vintage, currency, logo_url, theme_json, description, thesis, website, linkedin_url, founded_year")
    .limit(1);
  return data?.[0] ?? null;
}

export interface FundTheme {
  primary?: string;
  accent?: string;
  navy?: string;
  chart?: string; // L.12 — main chart series color
}

export function parseTheme(raw: unknown): FundTheme {
  if (!raw || typeof raw !== "object") return {};
  const t = raw as Record<string, unknown>;
  const valid = (v: unknown): string | undefined => {
    if (typeof v !== "string") return undefined;
    return /^#[0-9a-fA-F]{6}$/.test(v) ? v : undefined;
  };
  return {
    primary: valid(t.primary),
    accent: valid(t.accent),
    navy: valid(t.navy),
    chart: valid(t.chart),
  };
}


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
  /** L.6c — additional aggregated trends + per-company breakouts. */
  cashTrend: { quarter: string; value: number }[];
  burnTrend: { quarter: string; value: number }[];
  headcountTrend: { quarter: string; value: number }[];
  watchList: DashboardCompany[];
}

// Period strings sort lexicographically wrong, so we parse them.
// Accepts: "Q1 2026", "M03 2026", "Mar 2026", "FY 2026".
const MONTH_NAMES = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
function quarterSortKey(s: string): number {
  const t = s.trim();
  // Q1 2026 → year*1000 + 3 (quarter-end month) * 10 + 1 (kind=quarter)
  let m = /^Q([1-4])\s+(\d{4})$/i.exec(t);
  if (m) return parseInt(m[2], 10) * 1000 + parseInt(m[1], 10) * 30 + 1;
  // M03 2026 → year*1000 + month*10 + 0 (kind=month)
  m = /^M(\d{2})\s+(\d{4})$/i.exec(t);
  if (m) return parseInt(m[2], 10) * 1000 + parseInt(m[1], 10) * 10;
  // Jan 2026 / January 2026
  m = /^([A-Za-z]+)\s+(\d{4})$/.exec(t);
  if (m) {
    const idx = MONTH_NAMES.indexOf(m[1].slice(0, 3).toLowerCase());
    if (idx >= 0) return parseInt(m[2], 10) * 1000 + (idx + 1) * 10;
  }
  // FY 2026
  m = /^FY\s+(\d{4})$/i.exec(t);
  if (m) return parseInt(m[1], 10) * 1000 + 12 * 10 + 2;
  return 0;
}

function normalizeStatus(s: CompanyRow["status"]): DashboardCompany["status"] {
  return s === "no_data" ? "no-data" : s;
}

function num(n: number | null | undefined): number {
  return n == null ? 0 : Number(n);
}

// L.10/Fase 1.G — name-convention map from sheet column to canonical metric.
// Each company's sheet may have arbitrary columns (the GP and forms create
// them freely). For the fund-level rollups we look at columns whose name,
// case-insensitive, matches one of these keys. Companies that don't expose
// the column simply contribute 0 to that metric for that period.
const METRIC_NAME_MAP: Record<string, "arr" | "burn" | "cash" | "headcount" | "revenue"> = {
  arr: "arr",
  mrr: "arr",
  burn: "burn",
  "monthly burn": "burn",
  cash: "cash",
  "cash on hand": "cash",
  headcount: "headcount",
  "head count": "headcount",
  fte: "headcount",
  revenue: "revenue",
};

/** Convert a single sheet's columns + rows into the legacy DashboardMetric[]
 *  shape. Looks for a "Period" column for the time axis and matches the rest
 *  by METRIC_NAME_MAP. Used by every dashboard / company-detail loader so
 *  there's exactly one place that knows the convention. */
function sheetRowsToMetrics(
  cols: { id: string; name: string }[],
  rows: { data: any }[],
): DashboardMetric[] {
  const periodCol = cols.find((c) => c.name.toLowerCase().trim() === "period");
  const colByMetric: Record<string, string> = {};
  for (const c of cols) {
    const key = METRIC_NAME_MAP[c.name.toLowerCase().trim()];
    if (key && !(key in colByMetric)) colByMetric[key] = c.id;
  }
  const periodId = periodCol?.id;
  return rows
    .map((r) => {
      const data = (r.data ?? {}) as Record<string, any>;
      const periodLabel = periodId ? String(data[periodId] ?? "").trim() : "";
      if (!periodLabel) return null;
      return {
        quarter: periodLabel,
        arr: num(colByMetric.arr ? data[colByMetric.arr] : null),
        burn: num(colByMetric.burn ? data[colByMetric.burn] : null),
        cash: num(colByMetric.cash ? data[colByMetric.cash] : null),
        headcount: num(colByMetric.headcount ? data[colByMetric.headcount] : null),
        revenue: num(colByMetric.revenue ? data[colByMetric.revenue] : null),
      } as DashboardMetric;
    })
    .filter((m): m is DashboardMetric => m !== null)
    .sort((a, b) => quarterSortKey(a.quarter) - quarterSortKey(b.quarter));
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = createClient();

  // RLS scopes everything to the caller's organization.
  const [orgsRes, companiesRes, sheetsRes] = await Promise.all([
    supabase.from("organizations").select("id, name, size_usd, deployed_usd, vintage, currency").limit(1),
    supabase
      .from("companies")
      .select("id, slug, name, status, flag")
      .is("archived_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("sheets")
      .select("id, company_id, sheet_columns(id, name), sheet_rows(data, position)")
      .order("position", { foreignTable: "sheet_rows", ascending: true }),
  ]);

  if (orgsRes.error)      console.error("[getDashboardData] orgs error:",      orgsRes.error);
  if (companiesRes.error) console.error("[getDashboardData] companies error:", companiesRes.error);
  if (sheetsRes.error)    console.error("[getDashboardData] sheets error:",    sheetsRes.error);

  const orgs = orgsRes.data ?? [];
  const companyRows = companiesRes.data ?? [];
  const sheetRows = sheetsRes.data ?? [];

  const organization = orgs[0] ?? null;

  // Build a map: company_id → DashboardMetric[] derived from its sheet.
  const metricsByCompany = new Map<string, DashboardMetric[]>();
  for (const s of sheetRows as any[]) {
    metricsByCompany.set(
      s.company_id,
      sheetRowsToMetrics(s.sheet_columns ?? [], s.sheet_rows ?? []),
    );
  }

  const companies: DashboardCompany[] = companyRows.map((c: any) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    status: normalizeStatus(c.status),
    flag: c.flag,
    metrics: metricsByCompany.get(c.id) ?? [],
  }));

  const kpis = computeKpis(companies);
  const arrTrend = computeArrTrend(companies);
  const cashTrend = computeMetricTrend(companies, "cash");
  const burnTrend = computeMetricTrend(companies, "burn");
  const headcountTrend = computeMetricTrend(companies, "headcount");
  const watchList = companies
    .filter((c) => c.status === "critical" || c.status === "watch")
    .sort((a, b) => (a.status === "critical" ? -1 : 1));

  return { organization, companies, kpis, arrTrend, cashTrend, burnTrend, headcountTrend, watchList };
}

/** Sum a numeric metric across companies for each period. */
function computeMetricTrend(
  companies: DashboardCompany[],
  metric: "cash" | "burn" | "headcount" | "revenue",
): { quarter: string; value: number }[] {
  const buckets = new Map<string, number>();
  for (const c of companies) {
    for (const m of c.metrics) {
      buckets.set(m.quarter, (buckets.get(m.quarter) ?? 0) + (m as any)[metric]);
    }
  }
  return Array.from(buckets.entries())
    .sort((a, b) => quarterSortKey(a[0]) - quarterSortKey(b[0]))
    .map(([quarter, value]) => ({ quarter, value }));
}

function computeKpis(companies: DashboardCompany[]): DashboardKpis {
  // L.12 — metrics are now monthly. "prev" = previous month (MoM). "yoy" = 12
  // months back. The DashboardKpis field name `qoqArrGrowth` stays for
  // backwards-compat with consumers (the dashboard renders it as "MoM" now).
  const latest = (c: DashboardCompany) => c.metrics[c.metrics.length - 1];
  const prev = (c: DashboardCompany) => c.metrics[c.metrics.length - 2];
  const yoy = (c: DashboardCompany) => c.metrics[c.metrics.length - 13];

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

// ---------------------------------------------------------------------------
// Companies list + detail
// ---------------------------------------------------------------------------

export interface CompanyListItem {
  slug: string;
  name: string;
  sector: string | null;
  country: string | null;
  stage: CompanyRow["stage"];
  status: DashboardCompany["status"];
  invested: number;
  description: string | null;
  lastUpdate: string;
  logoUrl: string | null;
  metrics: DashboardMetric[];
  /** L.6 — investment vehicle (SAFE / Convertible / Equity / etc.). Null = unknown. */
  investmentInstrument: Database["public"]["Enums"]["investment_instrument"] | null;
  /** L.12 — per-company tracking cadence (defaults to "monthly"). */
  trackingCadence: Database["public"]["Enums"]["tracking_cadence"];
}

export async function getCompanyList(opts?: { archived?: boolean }): Promise<CompanyListItem[]> {
  const supabase = createClient();
  let companyQ = supabase
    .from("companies")
    .select(
      "id, slug, name, sector, country, stage, status, invested_usd, description, last_update_at, logo_url, investment_instrument, tracking_cadence"
    )
    .order("name", { ascending: true });
  companyQ = opts?.archived
    ? companyQ.not("archived_at", "is", null)
    : companyQ.is("archived_at", null);

  const [companiesRes, sheetsRes] = await Promise.all([
    companyQ,
    supabase
      .from("sheets")
      .select("id, company_id, sheet_columns(id, name), sheet_rows(data, position)")
      .order("position", { foreignTable: "sheet_rows", ascending: true }),
  ]);

  if (companiesRes.error) console.error("[getCompanyList] companies error:", companiesRes.error);
  if (sheetsRes.error)    console.error("[getCompanyList] sheets error:",    sheetsRes.error);

  const companies = companiesRes.data ?? [];
  const sheets = sheetsRes.data ?? [];

  const metricsByCompany = new Map<string, DashboardMetric[]>();
  for (const s of sheets as any[]) {
    metricsByCompany.set(
      s.company_id,
      sheetRowsToMetrics(s.sheet_columns ?? [], s.sheet_rows ?? []),
    );
  }

  return companies.map((c: any) => ({
    slug: c.slug,
    name: c.name,
    sector: c.sector,
    country: c.country,
    stage: c.stage,
    status: normalizeStatus(c.status),
    invested: num(c.invested_usd),
    description: c.description,
    lastUpdate: relativeTime(c.last_update_at),
    logoUrl: c.logo_url ?? null,
    investmentInstrument: c.investment_instrument ?? null,
    trackingCadence: c.tracking_cadence ?? "monthly",
    metrics: metricsByCompany.get(c.id) ?? [],
  }));
}

export type InvestmentInstrument = Database["public"]["Enums"]["investment_instrument"];

export async function getArchivedCompanyCount(): Promise<number> {
  const supabase = createClient();
  const { count } = await supabase
    .from("companies")
    .select("id", { count: "exact", head: true })
    .not("archived_at", "is", null);
  return count ?? 0;
}

export interface CompanyDetail extends CompanyListItem {
  ownership: number;
  flag: string | null;
  founder: { name: string; email: string; role: string };
  /** L.5d — additional founder emails. Empty when only founder.email is set. */
  founderEmails: string[];
  investmentInstrument: InvestmentInstrument | null;
  safeCapUsd: number | null;
  safeDiscountPct: number | null;
  website: string | null;
  linkedinUrl: string | null;
  /** L.4c — soft-delete timestamp. Null means active. */
  archivedAt: string | null;
}

export async function getCompanyBySlug(slug: string): Promise<CompanyDetail | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("companies")
    .select(
      "id, slug, name, sector, country, stage, status, invested_usd, ownership_pct, flag, description, last_update_at, logo_url, founder_name, founder_email, founder_emails, founder_role, investment_instrument, safe_cap_usd, safe_discount_pct, website, linkedin_url, tracking_cadence, archived_at"
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  const c = data as any;

  // Pull this company's sheet (one-per-company). Two queries are simpler than
  // a deep nested select and let RLS filter naturally.
  const { data: sheet } = await supabase
    .from("sheets")
    .select("id, sheet_columns(id, name), sheet_rows(data, position)")
    .eq("company_id", c.id)
    .order("position", { foreignTable: "sheet_rows", ascending: true })
    .maybeSingle();

  const metrics = sheet
    ? sheetRowsToMetrics(((sheet as any).sheet_columns ?? []), ((sheet as any).sheet_rows ?? []))
    : [];

  return {
    slug: c.slug,
    name: c.name,
    sector: c.sector,
    country: c.country,
    stage: c.stage,
    status: normalizeStatus(c.status),
    invested: num(c.invested_usd),
    description: c.description,
    lastUpdate: relativeTime(c.last_update_at),
    logoUrl: c.logo_url ?? null,
    ownership: num(c.ownership_pct),
    flag: c.flag,
    founder: {
      name: c.founder_name ?? "",
      email: c.founder_email ?? "",
      role: c.founder_role ?? "",
    },
    founderEmails: ((c.founder_emails ?? []) as string[]).filter(Boolean),
    investmentInstrument: c.investment_instrument ?? null,
    safeCapUsd: c.safe_cap_usd != null ? Number(c.safe_cap_usd) : null,
    safeDiscountPct: c.safe_discount_pct != null ? Number(c.safe_discount_pct) : null,
    website: c.website ?? null,
    linkedinUrl: c.linkedin_url ?? null,
    trackingCadence: c.tracking_cadence ?? "monthly",
    archivedAt: c.archived_at ?? null,
    metrics,
  };
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

export type FormCadence = "monthly" | "quarterly" | "annual" | "ad-hoc";

export interface FormTemplateSummary {
  id: string;
  slug: string;
  name: string;
  cadence: FormCadence;
  fieldCount: number;
  responseRate: number;
  lastSent: string | null;
}

export async function getFormTemplates(): Promise<FormTemplateSummary[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("forms")
    .select("id, slug, name, cadence, fields_json, response_rate, last_sent_at, active")
    .eq("active", true)
    .order("name", { ascending: true });

  return (data ?? []).map((f: any) => ({
    id: f.id as string,
    slug: f.slug as string,
    name: f.name as string,
    cadence: (f.cadence === "ad_hoc" ? "ad-hoc" : f.cadence) as FormCadence,
    fieldCount: Array.isArray(f.fields_json) ? (f.fields_json as unknown[]).length : 0,
    responseRate: Number(f.response_rate ?? 0),
    lastSent: f.last_sent_at ? formatShortDate(f.last_sent_at) : null,
  }));
}

// ---------------------------------------------------------------------------
// LPs
// ---------------------------------------------------------------------------

export interface LpRoster {
  id: string;
  name: string;
  type: LpRow["type"];
  commitment: number;
  country: string | null;
  email: string | null;
  lastAccess: string;
}

export async function getLpRoster(): Promise<LpRoster[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("lps")
    .select("id, name, type, commitment_usd, country, email, last_access_at")
    .order("commitment_usd", { ascending: false });

  return (data ?? []).map((l: any) => ({
    id: l.id as string,
    name: l.name as string,
    type: l.type as LpRow["type"],
    commitment: num(l.commitment_usd),
    country: l.country as string | null,
    email: l.email as string | null,
    lastAccess: relativeTime(l.last_access_at),
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  const day = 24 * 60 * 60 * 1000;
  const days = Math.round(diffMs / day);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const w = Math.round(days / 7);
    return w === 1 ? "1 week ago" : `${w} weeks ago`;
  }
  if (days < 365) {
    const m = Math.round(days / 30);
    return m === 1 ? "1 month ago" : `${m} months ago`;
  }
  const y = Math.round(days / 365);
  return y === 1 ? "1 year ago" : `${y} years ago`;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Form template detail (authenticated GP view)
// ---------------------------------------------------------------------------

export type FormFieldRow = {
  id: string;
  type: "currency" | "number" | "percent" | "text" | "longtext" | "select" | "date" | "news";
  label: string;
  required?: boolean;
  group?: string;
  options?: string[];
  /** L.4d — auto-write target for numeric fields. Null/undefined = narrative. */
  metricKey?: "arr" | "burn" | "cash" | "revenue" | "headcount" | null;
  metricDefinitionId?: string | null;
};

export interface FormTemplateDetail {
  id: string;
  slug: string;
  name: string;
  cadence: FormCadence;
  fields: FormFieldRow[];
  responseRate: number;
  sentToCount: number;
  lastSent: string | null;
  active: boolean;
  recentSubmissions: Array<{
    id: string;
    companyName: string;
    submittedAt: string;
    submittedBy: string | null;
    aiExtracted: boolean;
  }>;
}

export async function getFormBySlug(slug: string): Promise<FormTemplateDetail | null> {
  const supabase = createClient();
  const { data: form } = await supabase
    .from("forms")
    .select("id, slug, name, cadence, fields_json, response_rate, sent_to_count, last_sent_at, active")
    .eq("slug", slug)
    .maybeSingle();
  if (!form) return null;

  const { data: subs } = await supabase
    .from("form_submissions")
    .select("id, submitted_at, submitted_by_email, ai_extracted, companies(name)")
    .eq("form_id", form.id)
    .order("submitted_at", { ascending: false })
    .limit(10);

  return {
    id: form.id,
    slug: form.slug,
    name: form.name,
    cadence: form.cadence === "ad_hoc" ? "ad-hoc" : (form.cadence as FormCadence),
    fields: Array.isArray(form.fields_json) ? (form.fields_json as unknown as FormFieldRow[]) : [],
    responseRate: Number(form.response_rate ?? 0),
    sentToCount: form.sent_to_count ?? 0,
    lastSent: form.last_sent_at ? formatShortDate(form.last_sent_at) : null,
    active: form.active,
    recentSubmissions: (subs ?? []).map((s: any) => ({
      id: s.id,
      companyName: s.companies?.name ?? "Unknown",
      submittedAt: relativeTime(s.submitted_at),
      submittedBy: s.submitted_by_email,
      aiExtracted: s.ai_extracted,
    })),
  };
}

// ---------------------------------------------------------------------------
// Current user profile (for settings + sidebar identity)
// ---------------------------------------------------------------------------

export interface CurrentUserProfile {
  authUserId: string;
  email: string;
  name: string | null;
  role: string;
  organizationName: string | null;
  organizationId: string | null;
}

export async function getCurrentUser(): Promise<CurrentUserProfile | null> {
  const supabase = createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const { data: row } = await supabase
    .from("users")
    .select("email, name, role, organization_id, organizations(name)")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();

  return {
    authUserId: authUser.id,
    email: row?.email ?? authUser.email ?? "",
    name: row?.name ?? null,
    role: row?.role ?? "viewer",
    organizationName: (row as any)?.organizations?.name ?? null,
    organizationId: row?.organization_id ?? null,
  };
}

// ---------------------------------------------------------------------------
// Public RPCs (anonymous founders + LPs)
// ---------------------------------------------------------------------------

export interface PublicFormPayload {
  form: {
    id: string;
    slug: string;
    name: string;
    cadence: string;
    fields: FormFieldRow[];
  };
  company: {
    id: string;
    slug: string;
    name: string;
    founder_name: string | null;
    founder_email: string | null;
  };
  organization: { name: string };
}

export async function getPublicForm(
  formSlug: string,
  companySlug: string
): Promise<PublicFormPayload | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_public_form", {
    p_form_slug: formSlug,
    p_company_slug: companySlug,
  });
  if (error || !data) return null;
  const payload = data as any;
  if (!payload?.form || !payload?.company) return null;
  return {
    form: {
      id: payload.form.id,
      slug: payload.form.slug,
      name: payload.form.name,
      cadence: payload.form.cadence,
      fields: Array.isArray(payload.form.fields) ? payload.form.fields : [],
    },
    company: payload.company,
    organization: payload.organization ?? { name: "" },
  };
}

export interface ShareLetterPayload {
  organization: {
    name: string;
    vintage: number | null;
    size_usd: number;
    deployed_usd: number;
    currency: string;
    description: string | null;
    thesis: string | null;
    website: string | null;
    logo_url: string | null;
  };
  share: {
    token: string;
    watermark_email: string | null;
    expires_at: string | null;
    view_count: number;
  };
  companies: Array<{
    slug: string;
    name: string;
    sector: string | null;
    country: string | null;
    status: "healthy" | "watch" | "critical" | "no-data";
    metrics: Array<{
      quarter: string;
      arr: number;
      burn: number;
      cash: number;
      revenue: number;
      headcount: number;
    }>;
  }>;
}

export async function getShareLetter(token: string): Promise<
  | { kind: "ok"; data: ShareLetterPayload }
  | { kind: "expired" }
  | { kind: "not_found" }
> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_share_letter", { p_token: token });
  if (error || data == null) return { kind: "not_found" };
  const payload = data as any;
  if (payload?.expired) return { kind: "expired" };
  if (!payload?.organization) return { kind: "not_found" };

  const companies = (payload.companies ?? []).map((c: any) => ({
    slug: c.slug,
    name: c.name,
    sector: c.sector,
    country: c.country,
    status: (c.status === "no_data" ? "no-data" : c.status) as ShareLetterPayload["companies"][number]["status"],
    metrics: ((c.metrics ?? []) as any[])
      .map((m) => ({
        quarter: m.quarter,
        arr: num(m.arr),
        burn: num(m.burn),
        cash: num(m.cash),
        revenue: num(m.revenue),
        headcount: num(m.headcount),
      }))
      .sort((a, b) => quarterSortKey(a.quarter) - quarterSortKey(b.quarter)),
  }));

  return {
    kind: "ok",
    data: {
      organization: {
        name: payload.organization.name,
        vintage: payload.organization.vintage,
        size_usd: num(payload.organization.size_usd),
        deployed_usd: num(payload.organization.deployed_usd),
        currency: payload.organization.currency ?? "USD",
        description: payload.organization.description ?? null,
        thesis: payload.organization.thesis ?? null,
        website: payload.organization.website ?? null,
        logo_url: payload.organization.logo_url ?? null,
      },
      share: {
        token: payload.share?.token ?? token,
        watermark_email: payload.share?.watermark_email ?? null,
        expires_at: payload.share?.expires_at ?? null,
        view_count: num(payload.share?.view_count ?? 0),
      },
      companies,
    },
  };
}

// ---------------------------------------------------------------------------
// Form recipients + company picker options
// ---------------------------------------------------------------------------

export interface CompanyOption {
  id: string;
  slug: string;
  name: string;
}

export async function getCompanyOptions(): Promise<CompanyOption[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("companies")
    .select("id, slug, name")
    .is("archived_at", null)
    .order("name", { ascending: true });
  return (data ?? []).map((c: any) => ({ id: c.id, slug: c.slug, name: c.name }));
}

export async function getFormRecipientIds(formId: string): Promise<string[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("form_recipients")
    .select("company_id")
    .eq("form_id", formId);
  return (data ?? []).map((r: any) => r.company_id);
}

export interface LpLetterListItem {
  token: string;
  expiresAt: string | null;
  viewCount: number;
  createdAt: string;
  organizationName: string;
}

export async function getLpLetters(): Promise<LpLetterListItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_lp_letters");
  if (error || !data) return [];
  const arr = Array.isArray(data) ? data : [];
  return (arr as any[]).map((r) => ({
    token: r.token,
    expiresAt: r.expires_at,
    viewCount: Number(r.view_count ?? 0),
    createdAt: r.created_at,
    organizationName: r.organization_name,
  }));
}

// ---------------------------------------------------------------------------
// Team / invitations
// ---------------------------------------------------------------------------

export interface OrgMember {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

export interface OrgInvitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
}

export interface OrgMembersResult {
  members: OrgMember[];
  invitations: OrgInvitation[];
}

export async function getOrgMembers(): Promise<OrgMembersResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_org_members");
  if (error || !data) return { members: [], invitations: [] };

  const payload = data as any;
  const members = ((payload?.members ?? []) as any[]).map((m) => ({
    id: m.id,
    email: m.email,
    name: m.name,
    role: m.role,
    createdAt: m.created_at,
  }));
  const invitations = ((payload?.invitations ?? []) as any[]).map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    expiresAt: i.expires_at,
    createdAt: i.created_at,
  }));
  return { members, invitations };
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export async function getNotifications(limit = 20): Promise<NotificationItem[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, link, read_at, created_at, metadata_json")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((n: any) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    link: n.link,
    readAt: n.read_at,
    createdAt: n.created_at,
    metadata: (n.metadata_json ?? {}) as Record<string, unknown>,
  }));
}

export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Newsletter feed: extract news/update text from form_submissions.data_json
// using the form's own fields_json schema to know which keys are narrative.
// ---------------------------------------------------------------------------

export interface NewsletterUpdate {
  id: string;            // submission id (row may emit several updates if multiple news fields)
  field_key: string;
  company_slug: string;
  company_name: string;
  form_name: string;
  field_label: string;
  text: string;
  submitted_at: string;
}

function isNewsField(field: FormFieldRow): boolean {
  if (field.type === "news") return true;
  // Heuristic for legacy forms: longtext fields whose group/label hints at news.
  if (field.type === "longtext") {
    const hay = `${field.group ?? ""} ${field.label ?? ""}`.toLowerCase();
    return /\b(news|update|milestone|press|wins?)\b/.test(hay);
  }
  return false;
}

export async function getNewsletterUpdates(
  limit = 12,
  opts?: { companySlug?: string }
): Promise<NewsletterUpdate[]> {
  const supabase = createClient();
  let query = supabase
    .from("form_submissions")
    .select(
      "id, data_json, submitted_at, " +
      "companies!inner(slug, name), " +
      "forms(name, fields_json)"
    )
    .order("submitted_at", { ascending: false });

  if (opts?.companySlug) {
    query = query.eq("companies.slug", opts.companySlug);
  }

  const { data } = await query.limit(80);

  if (!data) return [];

  const updates: NewsletterUpdate[] = [];
  for (const s of data as any[]) {
    const fields: FormFieldRow[] = Array.isArray(s.forms?.fields_json) ? s.forms.fields_json : [];
    const newsFields = fields.filter(isNewsField);
    if (newsFields.length === 0) continue;

    const dataJson = (s.data_json ?? {}) as Record<string, unknown>;
    for (const f of newsFields) {
      const raw = dataJson[f.id];
      const text = typeof raw === "string" ? raw.trim() : "";
      if (!text) continue;
      updates.push({
        id: `${s.id}:${f.id}`,
        field_key: f.id,
        company_slug: s.companies?.slug ?? "",
        company_name: s.companies?.name ?? "Unknown",
        form_name: s.forms?.name ?? "",
        field_label: f.label,
        text,
        submitted_at: s.submitted_at,
      });
      if (updates.length >= limit) return updates;
    }
  }
  return updates;
}

// ---------------------------------------------------------------------------
// Data matrix — companies × quarters × metrics for the /data spreadsheet view
// ---------------------------------------------------------------------------

import { DATA_METRICS, type DataMetricKey } from "@/lib/data-metrics";
export { DATA_METRICS };
export type { DataMetricKey };

export interface DataMatrixCompany {
  id: string;
  slug: string;
  name: string;
  sector: string | null;
  country: string | null;
  stage: string;
  status: "healthy" | "watch" | "critical" | "no-data";
  logoUrl: string | null;
  metrics: Record<string, Record<DataMetricKey, number | null>>; // metrics[quarter][key]
}

/** L.3 — per-cell GP note keyed as `${companyId}|${quarter}|${metricKey}`. */
export type DataMetricNotes = Record<string, string>;

export interface DataMatrix {
  quarters: string[];                 // sorted oldest → newest
  companies: DataMatrixCompany[];     // sorted by name
  notes: DataMetricNotes;             // L.3
  columnsConfig: import("./data-columns-config").DataColumnsConfig; // L.3
}

// Re-uses the broader quarterSortKey logic; kept as an exported alias for the
// /data spreadsheet which calls it directly.
export function quarterKey(q: string): number {
  return quarterSortKey(q);
}

export async function getDataMatrix(): Promise<DataMatrix> {
  const supabase = createClient();
  const { parseDataColumnsConfig, defaultDataColumnsConfig } = await import("./data-columns-config");

  // Three queries in parallel; RLS scopes everything to the caller's org.
  const [
    { data: rows },
    { data: orgs },
    { data: noteRows },
  ] = await Promise.all([
    supabase
      .from("companies")
      .select("id, slug, name, sector, country, stage, status, logo_url")
      .is("archived_at", null)
      .order("name", { ascending: true }),
    supabase.from("organizations").select("data_columns_json").limit(1),
    supabase.from("metric_notes").select("company_id, quarter, metric_key, note, period_year, period_month, period_kind"),
  ]);

  const quartersSet = new Set<string>();
  const companies: DataMatrixCompany[] = [];

  for (const c of (rows ?? []) as any[]) {
    // /data page is gone; this matrix is now only used by the metrics CSV
    // export endpoint. We hand back empty per-company matrices for now —
    // wiring this to read sheets is a follow-up.
    const matrix: Record<string, Record<DataMetricKey, number | null>> = {};
    companies.push({
      id: c.id, slug: c.slug, name: c.name,
      sector: c.sector, country: c.country, stage: c.stage,
      status: c.status === "no_data" ? "no-data" : c.status,
      logoUrl: c.logo_url ?? null,
      metrics: matrix,
    });
  }

  const quarters = Array.from(quartersSet).sort((a, b) => quarterKey(a) - quarterKey(b));

  const notes: DataMetricNotes = {};
  for (const n of (noteRows ?? []) as any[]) {
    notes[`${n.company_id}|${metricRowToLabel(n)}|${n.metric_key}`] = n.note;
  }

  const columnsConfig = orgs?.[0]?.data_columns_json
    ? parseDataColumnsConfig(orgs[0].data_columns_json)
    : defaultDataColumnsConfig();

  return { quarters, companies, notes, columnsConfig };
}

// ---------------------------------------------------------------------------
// Company updates (manual GP notes/activity feed)
// ---------------------------------------------------------------------------

export interface CompanyUpdate {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string | null; name: string | null; email: string | null };
}

export async function getCompanyUpdates(companyId: string, limit = 50): Promise<CompanyUpdate[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("company_updates")
    .select("id, body, created_at, author_user_id, users(id, name, email)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.created_at,
    author: {
      id: r.users?.id ?? r.author_user_id ?? null,
      name: r.users?.name ?? null,
      email: r.users?.email ?? null,
    },
  }));
}

// ---------------------------------------------------------------------------
// L.10 — Form schedules (per-form cadence + reminder offsets)
// ---------------------------------------------------------------------------

import type { FormSchedule } from "./form-schedule";

export interface FormScheduleWithMeta extends FormSchedule {
  formName: string;
  formSlug: string;
}

// L.5b — load per-reminder rows for the schedule editor.
export async function getFormReminders(formId: string): Promise<import("./form-schedule").FormReminder[]> {
  const supabase = createClient();
  const { data } = await (supabase as any)
    .from("form_reminders")
    .select("id, form_id, offset_days, subject, body")
    .eq("form_id", formId)
    .order("offset_days", { ascending: false });
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    formId: r.form_id,
    offsetDays: r.offset_days,
    subject: r.subject,
    body: r.body,
  }));
}

// L.5b — recipients joined to company + founder defaults so the editor can
// render the table with effective email per row.
export async function getFormRecipientsWithEmails(formId: string): Promise<import("./form-schedule").FormRecipient[]> {
  const supabase = createClient();
  const { data } = await (supabase as any)
    .from("form_recipients")
    .select("company_id, founder_email_override, founder_emails, companies(slug, name, founder_email, founder_emails)")
    .eq("form_id", formId);
  return ((data ?? []) as any[])
    .map((r) => {
      const c = r.companies ?? {};
      const compDefaults: string[] = (c.founder_emails ?? []).filter(Boolean);
      const fallback = c.founder_email ? [c.founder_email] : [];
      const defList = compDefaults.length > 0 ? compDefaults : fallback;
      const recipList: string[] = (r.founder_emails ?? []).filter(Boolean);
      // Effective list: per-recipient override list wins; else fall back to
      // the company's founder list; else legacy single override; else company.founder_email.
      const effective = recipList.length > 0
        ? recipList
        : (r.founder_email_override ? [r.founder_email_override] : defList);
      return {
        companyId: r.company_id,
        companySlug: c.slug ?? "",
        companyName: c.name ?? "",
        founderEmailDefault: c.founder_email ?? null,
        founderEmailDefaults: defList,
        founderEmailOverride: r.founder_email_override ?? null,
        founderEmails: recipList,
        effectiveEmail: effective[0] ?? null,
        effectiveEmails: effective,
      };
    })
    .sort((a, b) => a.companyName.localeCompare(b.companyName));
}

export async function getFormSchedule(formId: string): Promise<FormSchedule | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("form_schedules")
    .select("*")
    .eq("form_id", formId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    formId: data.form_id,
    cadence: data.cadence,
    sendDayOfMonth: data.send_day_of_month,
    anchorMonth: data.anchor_month,
    reminderOffsetsDays: data.reminder_offsets_days ?? [],
    nextSendAt: data.next_send_at,
    lastSentAt: data.last_sent_at,
    active: data.active,
    emailSubject: (data as any).email_subject ?? null,
    emailBody: (data as any).email_body ?? null,
  };
}

/** All schedules across the org, joined to form name + slug (for the calendar). */
export async function getOrgFormSchedules(): Promise<FormScheduleWithMeta[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("form_schedules")
    .select("*, forms(name, slug)")
    .eq("active", true);
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    formId: r.form_id,
    cadence: r.cadence,
    sendDayOfMonth: r.send_day_of_month,
    anchorMonth: r.anchor_month,
    reminderOffsetsDays: r.reminder_offsets_days ?? [],
    nextSendAt: r.next_send_at,
    lastSentAt: r.last_sent_at,
    active: r.active,
    emailSubject: r.email_subject ?? null,
    emailBody: r.email_body ?? null,
    formName: r.forms?.name ?? "Untitled form",
    formSlug: r.forms?.slug ?? "",
  }));
}
