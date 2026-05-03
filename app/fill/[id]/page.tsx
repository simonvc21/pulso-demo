import { notFound } from "next/navigation";
import { getPublicForm } from "@/lib/dashboard-data";
import { PreviewBackBar } from "@/components/preview-back-bar";
import FillForm from "./fill-form";
import { getActiveFormForCompanySlug } from "@/lib/active-form";
import { resolveFillToken, companyHasFillToken } from "@/lib/fill-tokens";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
  searchParams: { company?: string; preview?: string; token?: string };
}

export default async function FillPage({ params, searchParams }: PageProps) {
  let formSlug = params.id;
  const isPreview = searchParams?.preview === "1";
  const fillToken = searchParams?.token ?? null;

  // L.4e — resolve token first if provided. Token wins over ?company=<slug>
  // because tokens are revocable and bind to a specific company.
  let companySlug = searchParams?.company ?? "vextra";
  if (fillToken) {
    const resolved = await resolveFillToken(fillToken);
    if (!resolved) {
      return (
        <div className="min-h-screen bg-paper flex items-center justify-center px-6">
          <div className="bg-white rounded-2xl border border-line shadow-card p-8 max-w-md text-center">
            <div className="text-3xl mb-2">🔒</div>
            <h1 className="text-xl font-serif font-bold text-ink">Link expired</h1>
            <p className="text-sm text-muted mt-2">
              This founder link has been revoked or never existed. Ask your GP to send a fresh link.
            </p>
          </div>
        </div>
      );
    }
    companySlug = resolved.companySlug;
  } else if (!isPreview) {
    // No token supplied. If the company already has tokens, refuse — the
    // legacy ?company=<slug> path is locked once the GP has issued any token.
    const supabase = createClient();
    const { data: comp } = await supabase
      .from("companies")
      .select("id")
      .eq("slug", companySlug)
      .maybeSingle();
    if (comp?.id && (await companyHasFillToken(comp.id))) {
      return (
        <div className="min-h-screen bg-paper flex items-center justify-center px-6">
          <div className="bg-white rounded-2xl border border-line shadow-card p-8 max-w-md text-center">
            <div className="text-3xl mb-2">🔒</div>
            <h1 className="text-xl font-serif font-bold text-ink">Founder link required</h1>
            <p className="text-sm text-muted mt-2">
              This company requires a founder link to submit forms. Ask your GP for the link they sent you, or check your last form invitation.
            </p>
          </div>
        </div>
      );
    }
  }

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
      <FillForm payload={payload} fillToken={fillToken} />
    </>
  );
}
