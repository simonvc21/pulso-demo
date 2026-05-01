import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFormBySlug } from "@/lib/dashboard-data";
import { FormBuilder } from "../../form-builder";
import type { FormInput } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditFormPage({ params }: { params: { id: string } }) {
  const form = await getFormBySlug(params.id);
  if (!form) notFound();

  const supabase = createClient();
  const { count } = await supabase
    .from("companies")
    .select("id", { count: "exact", head: true });

  const initial: FormInput = {
    name: form.name,
    cadence: form.cadence,
    fields: form.fields.map((f) => ({
      id: f.id,
      type: f.type,
      label: f.label,
      required: f.required,
      group: f.group,
      options: f.options,
    })),
  };

  return (
    <FormBuilder
      mode="edit"
      slug={form.slug}
      initial={initial}
      recipientCount={count ?? 0}
    />
  );
}
