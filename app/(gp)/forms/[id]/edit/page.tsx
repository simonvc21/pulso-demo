import { notFound } from "next/navigation";
import {
  getFormBySlug,
  getCompanyOptions,
  getFormRecipientIds,
} from "@/lib/dashboard-data";
import { FormBuilder } from "../../form-builder";
import type { FormInput } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditFormPage({ params }: { params: { id: string } }) {
  const form = await getFormBySlug(params.id);
  if (!form) notFound();

  const [companies, recipientIds] = await Promise.all([
    getCompanyOptions(),
    getFormRecipientIds(form.id),
  ]);

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
      companies={companies}
      initialRecipientIds={recipientIds}
    />
  );
}
