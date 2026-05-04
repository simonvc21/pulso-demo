// L.10 / Fase 1.6 — Empty-state / first-sheet creation page. Lands here when
// the company has no sheets yet, or when the GP clicks "+ New sheet" from
// the sidebar without an inline name.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { TopbarBell } from "@/components/topbar-bell";
import { createClient } from "@/lib/supabase/server";
import { ts } from "@/lib/i18n-server";
import { NewSheetForm } from "./new-sheet-form";

export const dynamic = "force-dynamic";

export default async function NewSheetPage({ params }: { params: { slug: string } }) {
  const supabase = createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id, slug, name")
    .eq("slug", params.slug)
    .maybeSingle();
  if (!company) return notFound();

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
      />
      <div className="px-8 py-12 max-w-xl mx-auto">
        <div className="bg-white rounded-xl border border-line shadow-card p-6">
          <h1 className="text-xl font-serif font-semibold text-ink">Create your first sheet</h1>
          <p className="text-sm text-muted mt-1">
            A sheet is a custom table inside this company. Track KPIs, cap table history, hiring pipeline — anything you'd build in Excel or Airtable.
          </p>
          <NewSheetForm companyId={company.id} />
        </div>
      </div>
    </>
  );
}
