import { notFound } from "next/navigation";
import { getPublicForm } from "@/lib/dashboard-data";
import { PreviewBackBar } from "@/components/preview-back-bar";
import FillForm from "./fill-form";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
  searchParams: { company?: string; preview?: string };
}

export default async function FillPage({ params, searchParams }: PageProps) {
  const formSlug = params.id;
  const companySlug = searchParams?.company ?? "vextra";
  const isPreview = searchParams?.preview === "1";

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
