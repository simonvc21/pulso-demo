import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { parseDashboardConfig as parseDashboardConfigImpl, type DashboardConfig as DashboardConfigType } from "./dashboard-config";

type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
type MetricRow = Database["public"]["Tables"]["metrics"]["Row"];
type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];
type LpRow = Database["public"]["Tables"]["lps"]["Row"];

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
  };
}

// L.5 — Dashboard customization config: types + parser live in dashboard-config.ts
// (client-safe). Re-exported here so existing imports from dashboard-data keep working.
export {
  DEFAULT_DASHBOARD_CONFIG,
  parseDashboardConfig,
  type DashboardConfig,
  type DashboardWidgetAccent,
  type DashboardWidgetConfig,
  type DashboardWidgetId,
  type DashboardWidgetSize,
} from "./dashboard-config";

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
  dashboardConfig: DashboardConfigType;
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
    supabase.from("organizations").select("id, name, size_usd, deployed_usd, vintage, currency, dashboard_config_json").limit(1),
    supabase
      .from("companies")
      .select("id, slug, name, status, flag, metrics(quarter, arr_usd, burn_usd, cash_usd, headcount, revenue_usd)")
      .order("name", { ascending: true }),
  ]);

  const orgRow = orgs?.[0] ?? null;
  const organization = orgRow
    ? {
        id: orgRow.id,
        name: orgRow.name,
        size_usd: orgRow.size_usd,
        deployed_usd: orgRow.deployed_usd,
        vintage: orgRow.vintage,
        currency: orgRow.currency,
      }
    : null;
  const dashboardConfig = parseDashboardConfigImpl(orgRow?.dashboard_config_json);

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

  return { organization, companies, kpis, arrTrend, watchList, dashboardConfig };
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
}

export async function getCompanyList(): Promise<CompanyListItem[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("companies")
    .select(
      "slug, name, sector, country, stage, status, invested_usd, description, last_update_at, logo_url, " +
        "metrics(quarter, arr_usd, burn_usd, cash_usd, headcount, revenue_usd)"
    )
    .order("name", { ascending: true });

  return (data ?? []).map((c: any) => ({
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
    metrics: ((c.metrics ?? []) as MetricRow[])
      .map((m) => ({
        quarter: m.quarter,
        arr: num(m.arr_usd),
        burn: num(m.burn_usd),
        cash: num(m.cash_usd),
        headcount: num(m.headcount),
        revenue: num(m.revenue_usd),
      }))
      .sort((a, b) => quarterSortKey(a.quarter) - quarterSortKey(b.quarter)),
  }));
}

export interface CompanyDetail extends CompanyListItem {
  ownership: number;
  flag: string | null;
  founder: { name: string; email: string; role: string };
}

export async function getCompanyBySlug(slug: string): Promise<CompanyDetail | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("companies")
    .select(
      "slug, name, sector, country, stage, status, invested_usd, ownership_pct, flag, description, last_update_at, logo_url, founder_name, founder_email, founder_role, " +
        "metrics(quarter, arr_usd, burn_usd, cash_usd, headcount, revenue_usd)"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!data) return null;
  const c = data as any;
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
    metrics: ((c.metrics ?? []) as MetricRow[])
      .map((m) => ({
        quarter: m.quarter,
        arr: num(m.arr_usd),
        burn: num(m.burn_usd),
        cash: num(m.cash_usd),
        headcount: num(m.headcount),
        revenue: num(m.revenue_usd),
      }))
      .sort((a, b) => quarterSortKey(a.quarter) - quarterSortKey(b.quarter)),
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

export interface DataMatrix {
  quarters: string[];                 // sorted oldest → newest
  companies: DataMatrixCompany[];     // sorted by name
}

export function quarterKey(q: string): number {
  const m = /^Q(\d)\s+(\d{4})$/.exec(q.trim());
  if (!m) return 0;
  return parseInt(m[2], 10) * 10 + parseInt(m[1], 10);
}

export async function getDataMatrix(): Promise<DataMatrix> {
  const supabase = createClient();
  const { data: rows } = await supabase
    .from("companies")
    .select(
      "id, slug, name, sector, country, stage, status, logo_url, " +
        "metrics(quarter, arr_usd, burn_usd, cash_usd, revenue_usd, headcount)"
    )
    .order("name", { ascending: true });

  const quartersSet = new Set<string>();
  const companies: DataMatrixCompany[] = [];

  for (const c of (rows ?? []) as any[]) {
    const matrix: Record<string, Record<DataMetricKey, number | null>> = {};
    for (const m of (c.metrics ?? []) as any[]) {
      quartersSet.add(m.quarter);
      matrix[m.quarter] = {
        arr_usd:     m.arr_usd     != null ? Number(m.arr_usd)     : null,
        burn_usd:    m.burn_usd    != null ? Number(m.burn_usd)    : null,
        cash_usd:    m.cash_usd    != null ? Number(m.cash_usd)    : null,
        revenue_usd: m.revenue_usd != null ? Number(m.revenue_usd) : null,
        headcount:   m.headcount   != null ? Number(m.headcount)   : null,
      };
    }
    companies.push({
      id: c.id, slug: c.slug, name: c.name,
      sector: c.sector, country: c.country, stage: c.stage,
      status: c.status === "no_data" ? "no-data" : c.status,
      logoUrl: c.logo_url ?? null,
      metrics: matrix,
    });
  }

  const quarters = Array.from(quartersSet).sort((a, b) => quarterKey(a) - quarterKey(b));
  return { quarters, companies };
}
