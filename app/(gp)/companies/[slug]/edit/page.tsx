import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { TopbarBell } from "@/components/topbar-bell";
import { getCompanyBySlug } from "@/lib/dashboard-data";
import { CompanyEditForm } from "./edit-form";
import type { CompanyInput } from "../../actions";

export const dynamic = "force-dynamic";

const VALID_STATUS = ["healthy", "watch", "critical", "no_data"] as const;

export default async function EditCompanyPage({ params }: { params: { slug: string } }) {
  const company = await getCompanyBySlug(params.slug);
  if (!company) notFound();

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
      <div className="px-8 py-6 max-w-3xl">
        <CompanyEditForm slug={company.slug} initial={initial} />
      </div>
    </>
  );
}
