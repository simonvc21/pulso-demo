import { notFound } from "next/navigation";
import {
  getFormBySlug,
  getCompanyOptions,
  getFormRecipientIds,
  getFormSchedule,
} from "@/lib/dashboard-data";
import { FormBuilder } from "../../form-builder";
import type { FormInput } from "../../actions";
import { ScheduleEditor } from "./schedule-editor";

export const dynamic = "force-dynamic";

export default async function EditFormPage({ params }: { params: { id: string } }) {
  const form = await getFormBySlug(params.id);
  if (!form) notFound();

  const [companies, recipientIds, schedule] = await Promise.all([
    getCompanyOptions(),
    getFormRecipientIds(form.id),
    getFormSchedule(form.id),
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
    <div className="space-y-6">
      <FormBuilder
        mode="edit"
        slug={form.slug}
        initial={initial}
        companies={companies}
        initialRecipientIds={recipientIds}
      />
      <div className="px-8 max-w-5xl pb-12">
        <ScheduleEditor formSlug={form.slug} formName={form.name} initial={schedule} />
      </div>
    </div>
  );
}
