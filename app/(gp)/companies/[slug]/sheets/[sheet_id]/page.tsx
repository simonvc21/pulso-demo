// L.10 / Fase 1.6 — Active sheet view. Layout per spec §3:
//   • Topbar (company name + back link)
//   • Two-column body: SheetSidebar (sheet list) | main (KPIs + 2 charts + grid)

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Globe, Linkedin } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { TopbarBell } from "@/components/topbar-bell";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { ts } from "@/lib/i18n-server";
import { SheetSidebar } from "@/components/sheets/SheetSidebar";
import { SheetGrid } from "@/components/sheets/SheetGrid";
import { KpiStrip } from "@/components/sheets/KpiStrip";
import { SheetChart } from "@/components/sheets/SheetChart";
import {
  type Sheet,
  type SheetColumn,
  type SheetRow,
  type ColumnConfig,
  type ColumnType,
} from "@/components/sheets/types";

export const dynamic = "force-dynamic";

const countryFlag: Record<string, string> = {
  MX: "🇲🇽", BR: "🇧🇷", CO: "🇨🇴", CL: "🇨🇱", AR: "🇦🇷", PE: "🇵🇪",
};

export default async function SheetPage({
  params,
}: {
  params: { slug: string; sheet_id: string };
}) {
  const supabase = createClient();

  // Company → guard the route exists at all.
  const { data: company } = await supabase
    .from("companies")
    .select("id, slug, name, sector, country, stage, status, description, website, linkedin_url, logo_url")
    .eq("slug", params.slug)
    .maybeSingle();
  if (!company) return notFound();

  // Sidebar list + active sheet — fetched in parallel since they're independent.
  const [sheetsRes, activeSheetRes, columnsRes, rowsRes] = await Promise.all([
    supabase
      .from("sheets")
      .select("id, company_id, name, description, position")
      .eq("company_id", company.id)
      .order("position"),
    supabase
      .from("sheets")
      .select("id, company_id, name, description, position")
      .eq("id", params.sheet_id)
      .eq("company_id", company.id)
      .maybeSingle(),
    supabase
      .from("sheet_columns")
      .select("id, sheet_id, name, type, config, position")
      .eq("sheet_id", params.sheet_id)
      .order("position"),
    supabase
      .from("sheet_rows")
      .select("id, sheet_id, data, position")
      .eq("sheet_id", params.sheet_id)
      .order("position"),
  ]);

  const sheets = (sheetsRes.data ?? []) as Sheet[];
  if (!activeSheetRes.data) return notFound();
  const activeSheet = activeSheetRes.data as Sheet;

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

      <div className="flex min-h-[calc(100vh-57px)]">
        <SheetSidebar
          companyId={company.id}
          companySlug={company.slug}
          sheets={sheets}
          activeSheetId={activeSheet.id}
        />

        <div className="flex-1 min-w-0 px-6 py-5 space-y-5 animate-fade-in">
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
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-teal"
                    >
                      <Globe className="h-3 w-3" /> Website
                    </a>
                  )}
                  {company.linkedin_url && (
                    <a
                      href={company.linkedin_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-teal"
                    >
                      <Linkedin className="h-3 w-3" /> LinkedIn
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sheet title */}
          <div>
            <h1 className="text-2xl font-serif font-semibold text-ink">{activeSheet.name}</h1>
            {activeSheet.description && (
              <p className="text-sm text-muted mt-0.5">{activeSheet.description}</p>
            )}
          </div>

          {/* KPI strip */}
          <KpiStrip columns={columns} rows={rows} />

          {/* Two charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SheetChart columns={columns} rows={rows} index={0} />
            <SheetChart columns={columns} rows={rows} index={1} />
          </div>

          {/* Grid */}
          <SheetGrid sheetId={activeSheet.id} columns={columns} rows={rows} />
        </div>
      </div>
    </>
  );
}
