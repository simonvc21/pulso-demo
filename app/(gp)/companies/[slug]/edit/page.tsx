import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { TopbarBell } from "@/components/topbar-bell";
import { getCompanyBySlug, getCompanyCustomMetrics } from "@/lib/dashboard-data";
import { CompanyEditForm } from "./edit-form";
import { CompanyLogoUploader } from "./logo-uploader";
import { CustomMetricsEditor } from "./custom-metrics-editor";
import type { CompanyInput } from "../../actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const VALID_STATUS = ["healthy", "watch", "critical", "no_data"] as const;

export default async function EditCompanyPage({ params }: { params: { slug: string } }) {
  const company = await getCompanyBySlug(params.slug);
  if (!company) notFound();

  // Resolve the canonical company id (CompanyDetail exposes slug only) for
  // the custom-metrics editor.
  const supabase = createClient();
  const { data: companyRow } = await supabase
    .from("companies")
    .select("id")
    .eq("slug", params.slug)
    .maybeSingle();

  const customSeries = companyRow ? await getCompanyCustomMetrics(companyRow.id) : [];
  const contextQuarters = company.metrics.map((m) => m.quarter);

  // The dashboard-data layer returns "no-data" with a hyphen for the UI;
  // map back to the DB enum form for the input type.
  const dbStatus = (company.status === "no-data" ? "no_data" : company.status) as
    typeof VALID_STATUS[number];

  const initial: CompanyInput = {
    name: company.name,
    sector: company.sector,
    country: company.country,
    stage: company.stage,
    status: dbStatus,
    flag: company.flag,
    description: company.description,
    investedUsd: company.invested,
    ownershipPct: company.ownership,
    founder: {
      name: company.founder.name || null,
      email: company.founder.email || null,
      role: company.founder.role || null,
    },
    investmentInstrument: company.investmentInstrument,
    safeCapUsd: company.safeCapUsd,
    safeDiscountPct: company.safeDiscountPct,
    website: company.website,
    linkedinUrl: company.linkedinUrl,
  };

  return (
    <>
      <Topbar
        bell={<TopbarBell />}
        title={`Edit · ${company.name}`}
        breadcrumb={
          <Link href={`/companies/${company.slug}`} className="inline-flex items-center gap-1 hover:text-ink">
            <ArrowLeft className="h-3 w-3" /> Back to {company.name}
          </Link>
        }
      />
      <div className="px-8 py-6 max-w-3xl space-y-6">
        <CompanyLogoUploader companySlug={company.slug} initialLogoUrl={company.logoUrl ?? null} />
        <CompanyEditForm slug={company.slug} initial={initial} />
        {companyRow && (
          <CustomMetricsEditor
            companyId={companyRow.id}
            initialSeries={customSeries}
            contextQuarters={contextQuarters}
          />
        )}
      </div>
    </>
  );
}
