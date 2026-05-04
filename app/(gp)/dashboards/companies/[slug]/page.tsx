// L.10 / Fase 1.D — Read-only company dashboard. Same KPI strip + 2 charts
// as the editable view, no grid, no activity. The shareable shape.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Globe, Linkedin } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { TopbarBell } from "@/components/topbar-bell";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { CompanyDashboardView } from "@/components/dashboards/company-dashboard-view";

export const dynamic = "force-dynamic";

const countryFlag: Record<string, string> = {
  MX: "🇲🇽", BR: "🇧🇷", CO: "🇨🇴", CL: "🇨🇱", AR: "🇦🇷", PE: "🇵🇪",
};

export default async function CompanyDashboardPage({ params }: { params: { slug: string } }) {
  const supabase = createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id, slug, name, sector, country, status, description, website, linkedin_url, logo_url, stage")
    .eq("slug", params.slug)
    .maybeSingle();
  if (!company) return notFound();

  return (
    <>
      <Topbar
        bell={<TopbarBell />}
        title={`${company.name} — dashboard`}
        breadcrumb={
          <Link href="/dashboards" className="inline-flex items-center gap-1 hover:text-ink transition-colors">
            <ArrowLeft className="h-3 w-3" /> Back to dashboards
          </Link>
        }
      />
      <div className="px-8 py-6 space-y-5 animate-fade-in">
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
                <p className="text-xs text-muted mt-0.5">{company.description}</p>
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

        <CompanyDashboardView companyId={company.id} />
      </div>
    </>
  );
}
