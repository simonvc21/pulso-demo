import { notFound, redirect } from "next/navigation";
import { getPublicForm } from "@/lib/dashboard-data";
import { PreviewBackBar } from "@/components/preview-back-bar";
import FillForm from "./fill-form";
import { getActiveFormForCompanySlug } from "@/lib/active-form";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
  searchParams: { company?: string; preview?: string };
}

export default async function FillPage({ params, searchParams }: PageProps) {
  let formSlug = params.id;
  const companySlug = searchParams?.company ?? "vextra";
  const isPreview = searchParams?.preview === "1";

  // L.11 — magic slug "current" resolves to whichever form is the active
  // assignment for this company. Founder bookmark like
  // /fill/current?company=vextra always routes to "the form they need NOW".
  if (formSlug === "current") {
    const active = await getActiveFormForCompanySlug(companySlug);
    if (!active) {
      // No active form — show the all-caught-up state.
      return (
        <div className="min-h-screen bg-paper flex items-center justify-center px-6">
          <div className="bg-white rounded-2xl border border-line shadow-card p-8 max-w-md text-center">
            <div className="text-3xl mb-2">🎉</div>
            <h1 className="text-xl font-serif font-bold text-ink">All caught up</h1>
            <p className="text-sm text-muted mt-2">
              You don&apos;t have a form to fill out right now. Your GP will let you know when the next one is ready.
            </p>
          </div>
        </div>
      );
    }
    if (active.status === "submitted") {
      return (
        <div className="min-h-screen bg-paper flex items-center justify-center px-6">
          <div className="bg-white rounded-2xl border border-line shadow-card p-8 max-w-md text-center">
            <div className="text-3xl mb-2">✓</div>
            <h1 className="text-xl font-serif font-bold text-ink">Submitted</h1>
            <p className="text-sm text-muted mt-2">
              You already submitted <strong>{active.formName}</strong> for {active.periodLabel ?? "this period"}. Your GP has it.
            </p>
          </div>
        </div>
      );
    }
    formSlug = active.formSlug;
  }

  const payload = await getPublicForm(formSlug, companySlug);
  if (!payload) return notFound();

  return (
    <>
      {isPreview && (
        <PreviewBackBar
          backHref={`/forms/${formSlug}`}
          label={`Founder fill as ${payload.company.name}`}
        />
      )}
      <FillForm payload={payload} />
    </>
  );
}
