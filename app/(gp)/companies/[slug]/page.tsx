// L.10 / Fase 1.C — Company detail = sheet + activity sections.
// Layout (top to bottom):
//   1. Compact company header
//   2. Active form widget (status + send-extra button)
//   3. Sheet: KPI strip + 2 charts + grid
//   4. Activity: updates feed + comments thread
//   5. Portfolio newsletter feed (narrative cross-company updates)

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Globe, Linkedin } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { TopbarBell } from "@/components/topbar-bell";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { ts } from "@/lib/i18n-server";
import { SheetGrid } from "@/components/sheets/SheetGrid";
import { KpiStrip } from "@/components/sheets/KpiStrip";
import { SheetChart } from "@/components/sheets/SheetChart";
import {
  type SheetColumn,
  type SheetRow,
  type ColumnConfig,
  type ColumnType,
} from "@/components/sheets/types";
import { ActiveFormWidget } from "./active-form-widget";
import { UpdatesFeed } from "./updates-feed";
import { CommentsThread } from "@/components/lp-engagement";
import { PortfolioNewsletter } from "@/components/portfolio-newsletter";
import { getCompanyUpdates, getNewsletterUpdates } from "@/lib/dashboard-data";
import { getCompanyComments } from "@/lib/lp-engagement";
import { getActiveFormForCompany } from "@/lib/active-form";
import { listCompanyFillTokens } from "@/lib/fill-tokens";

export const dynamic = "force-dynamic";

const countryFlag: Record<string, string> = {
  MX: "🇲🇽", BR: "🇧🇷", CO: "🇨🇴", CL: "🇨🇱", AR: "🇦🇷", PE: "🇵🇪",
};

async function safeCall<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[company-detail] ${label} failed:`, err);
    return fallback;
  }
}

const DEFAULT_COLUMNS: Array<{ name: string; type: string; config: Record<string, any> }> = [
  { name: "Period",    type: "text",     config: {} },
  { name: "MRR",       type: "currency", config: { currency: "USD" } },
  { name: "Burn",      type: "currency", config: { currency: "USD" } },
  { name: "Cash",      type: "currency", config: { currency: "USD" } },
  { name: "Headcount", type: "number",   config: {} },
];

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

async function ensureDefaultColumns(supabase: ReturnType<typeof createClient>, sheetId: string) {
  // Only seed sheets that have zero columns. If the GP deleted columns on
  // purpose we don't want to re-add them on every page load.
  const { count } = await supabase
    .from("sheet_columns")
    .select("id", { count: "exact", head: true })
    .eq("sheet_id", sheetId);
  if ((count ?? 0) > 0) return;

  const inserts = DEFAULT_COLUMNS.map((c, i) => ({
    sheet_id: sheetId,
    name: c.name,
    type: c.type,
    config: c.config,
    position: i,
  }));
  const { data: created, error } = await supabase
    .from("sheet_columns")
    .insert(inserts as any)
    .select("id, name");
  if (error) {
    console.error("[company-detail] default-columns insert failed:", error);
    return;
  }

  // Add a starter row for the current month so the grid isn't empty.
  const periodCol = (created ?? []).find((c) => c.name.toLowerCase() === "period");
  if (!periodCol) return;
  const now = new Date();
  const periodLabel = `${MONTH_SHORT[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
  const rowData: Record<string, any> = { [periodCol.id]: periodLabel };
  await supabase
    .from("sheet_rows")
    .insert({ sheet_id: sheetId, data: rowData, position: 0 } as any);
}

export default async function CompanyPage({ params }: { params: { slug: string } }) {
  const supabase = createClient();

  const { data: company, error: companyErr } = await supabase
    .from("companies")
    .select("id, slug, name, sector, country, stage, status, description, website, linkedin_url, logo_url")
    .eq("slug", params.slug)
    .maybeSingle();
  if (companyErr) console.error("[company-detail] companies select error:", companyErr);
  if (!company) return notFound();

  // The single sheet for this company. Auto-create on first visit.
  let { data: sheet, error: sheetErr } = await supabase
    .from("sheets")
    .select("id, company_id, name, description, position")
    .eq("company_id", company.id)
    .maybeSingle();
  if (sheetErr) console.error("[company-detail] sheets select error:", sheetErr);

  if (!sheet) {
    const { data: created, error: insertErr } = await supabase
      .from("sheets")
      .insert({ company_id: company.id, name: "KPIs", position: 0 })
      .select("id, company_id, name, description, position")
      .single();
    if (insertErr) console.error("[company-detail] sheet insert error:", insertErr);
    sheet = created;
  }
  if (!sheet) return notFound();

  // L.10/Fase 1.K — first-visit seed. If the sheet has no columns yet (newly
  // created or migrated from an empty state) bootstrap a sensible default:
  // Period + MRR + Burn + Cash + Headcount, plus an empty row for the
  // current month so the GP has something to type into right away.
  await ensureDefaultColumns(supabase, sheet.id);

  // Sheet content + sidecar features. Each lane gets its own try/catch so a
  // single failure doesn't take down the entire page.
  const [
    columnsRes,
    rowsRes,
    activeForm,
    fillTokens,
    teamUpdates,
    comments,
    newsletterUpdates,
    formOptionsRes,
  ] = await Promise.all([
    supabase.from("sheet_columns").select("id, sheet_id, name, type, config, position").eq("sheet_id", sheet.id).order("position"),
    supabase.from("sheet_rows").select("id, sheet_id, data, position").eq("sheet_id", sheet.id).order("position"),
    safeCall("getActiveFormForCompany", () => getActiveFormForCompany(company.id), null),
    safeCall("listCompanyFillTokens", () => listCompanyFillTokens(company.id), [] as any[]),
    safeCall("getCompanyUpdates", () => getCompanyUpdates(company.id, 50), [] as any[]),
    safeCall("getCompanyComments", () => getCompanyComments(company.id), [] as any[]),
    safeCall("getNewsletterUpdates", () => getNewsletterUpdates(20, { companySlug: company.slug }), [] as any[]),
    supabase.from("forms").select("slug, name").eq("active", true).order("name"),
  ]);

  if (columnsRes.error)     console.error("[company-detail] sheet_columns error:", columnsRes.error);
  if (rowsRes.error)        console.error("[company-detail] sheet_rows error:",    rowsRes.error);
  if (formOptionsRes.error) console.error("[company-detail] forms error:",         formOptionsRes.error);

  const columns: SheetColumn[] = (columnsRes.data ?? []).map((c) => ({
    id: c.id,
    sheet_id: c.sheet_id,
    name: c.name,
    type: c.type as ColumnType,
    config: (c.config ?? {}) as ColumnConfig,
    position: c.position,
  }));
  const rows: SheetRow[] = (rowsRes.data ?? []).map((r) => ({
    id: r.id,
    sheet_id: r.sheet_id,
    data: (r.data ?? {}) as Record<string, any>,
    position: r.position,
  }));

  // Resolve current user (for delete-own-comment + canModerate logic).
  let currentUserId: string | null = null;
  let currentUserRole: string | null = null;
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const { data: profile } = await supabase
        .from("users")
        .select("id, role")
        .eq("auth_user_id", authUser.id)
        .maybeSingle();
      currentUserId = profile?.id ?? null;
      currentUserRole = profile?.role ?? null;
    }
  } catch (err) {
    console.error("[company-detail] auth resolve failed:", err);
  }
  const canModerate = ["gp", "managing_partner", "partner"].includes(currentUserRole ?? "");

  return (
    <>
      <Topbar
        bell={<TopbarBell />}
        title={company.name}
        breadcrumb={
          <Link href="/companies" className="inline-flex items-center gap-1 hover:text-ink transition-colors">
            <ArrowLeft className="h-3 w-3" /> {ts("companies.back_to_companies")}
          </Link>
        }
        actions={
          <Link href={`/companies/${company.slug}/edit`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" /> {ts("companies.edit")}
            </Button>
          </Link>
        }
      />

      <div className="px-6 py-5 space-y-5 animate-fade-in">
        {/* Compact company header */}
        <div className="bg-white rounded-xl border border-line shadow-card p-4">
          <div className="flex items-start gap-4">
            {company.logo_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={company.logo_url}
                alt={company.name}
                className="h-10 w-10 rounded-lg object-contain bg-white border border-line shrink-0"
              />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-navy flex items-center justify-center text-gold font-serif text-base font-bold shrink-0">
                {company.name[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-serif font-semibold text-ink">{company.name}</h2>
                {company.country && <span className="text-sm">{countryFlag[company.country] ?? ""}</span>}
                {company.status && <StatusBadge status={company.status as any} />}
              </div>
              {company.description && (
                <p className="text-xs text-muted mt-0.5 line-clamp-1">{company.description}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {company.sector && <Badge>{company.sector}</Badge>}
                {company.stage && <Badge>{company.stage}</Badge>}
                {company.website && (
                  <a href={company.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-teal">
                    <Globe className="h-3 w-3" /> Website
                  </a>
                )}
                {company.linkedin_url && (
                  <a href={company.linkedin_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-teal">
                    <Linkedin className="h-3 w-3" /> LinkedIn
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Active form status */}
        <ActiveFormWidget
          companyId={company.id}
          companySlug={company.slug}
          initial={activeForm}
          formOptions={(formOptionsRes.data ?? []) as { slug: string; name: string }[]}
          fillTokens={fillTokens}
        />

        {/* Sheet — KPI strip + charts + grid */}
        <KpiStrip columns={columns} rows={rows} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SheetChart columns={columns} rows={rows} index={0} />
          <SheetChart columns={columns} rows={rows} index={1} />
        </div>

        <SheetGrid sheetId={sheet.id} columns={columns} rows={rows} />

        {/* Activity */}
        <UpdatesFeed companyId={company.id} initial={teamUpdates} />

        <CommentsThread
          companyId={company.id}
          initial={comments}
          canModerate={canModerate}
          currentUserId={currentUserId}
        />

        {/* Cross-portfolio narrative updates */}
        <PortfolioNewsletter updates={newsletterUpdates} />
      </div>
    </>
  );
}
