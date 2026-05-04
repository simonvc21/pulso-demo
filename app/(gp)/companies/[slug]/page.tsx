// L.10 / Fase 1.6 — Company detail entry point. Redirects to the first sheet
// of the company, or to the "create first sheet" page when none exist yet.
//
// Note: the previous rich detail view (KPI grid, financial charts, forms
// widget, updates feed, comments thread, custom metrics block) was replaced
// in this commit per /docs/airtable-tables-spec.md §7. Those features still
// exist as components and can be re-homed in a Fase 2 layout — they're not
// rendered anywhere right now. See git history for the prior page.

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CompanyEntryPage({ params }: { params: { slug: string } }) {
  const supabase = createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id, slug")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!company) return notFound();

  const { data: firstSheet } = await supabase
    .from("sheets")
    .select("id")
    .eq("company_id", company.id)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (firstSheet) {
    redirect(`/companies/${company.slug}/sheets/${firstSheet.id}`);
  }

  redirect(`/companies/${company.slug}/sheets/new`);
}
