import { notFound } from "next/navigation";
import { getPublicForm } from "@/lib/dashboard-data";
import FillForm from "./fill-form";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
  searchParams: { company?: string };
}

// /fill/<form-slug>?company=<company-slug>
//   - id      = form slug (e.g. q1-2026-financials)
//   - company = company slug. Defaults to "vextra" so the GP-side preview
//     resolves out of the box; in production we'll mint per-recipient links.
export default async function FillPage({ params, searchParams }: PageProps) {
  const formSlug = params.id;
  const companySlug = searchParams?.company ?? "vextra";

  const payload = await getPublicForm(formSlug, companySlug);
  if (!payload) return notFound();

  return <FillForm payload={payload} />;
}
