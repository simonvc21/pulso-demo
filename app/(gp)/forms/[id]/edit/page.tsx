import { notFound } from "next/navigation";
import {
  getFormBySlug,
  getCompanyOptions,
  getFormRecipientIds,
  getFormSchedule,
  listOrgMetricDefinitions,
  getFormReminders,
  getFormRecipientsWithEmails,
} from "@/lib/dashboard-data";
import { createClient } from "@/lib/supabase/server";
import { FormBuilder } from "../../form-builder";
import type { FormInput } from "../../actions";
import { ScheduleEditor } from "./schedule-editor";

export const dynamic = "force-dynamic";

export default async function EditFormPage({ params }: { params: { id: string } }) {
  const form = await getFormBySlug(params.id);
  if (!form) notFound();

  const [companies, recipientIds, schedule, metricDefinitions, reminders, recipientsWithEmails] = await Promise.all([
    getCompanyOptions(),
    getFormRecipientIds(form.id),
    getFormSchedule(form.id),
    listOrgMetricDefinitions(),
    getFormReminders(form.id),
    getFormRecipientsWithEmails(form.id),
  ]);

  // Pull every active company with founder_email for the recipients picker.
  const supabase = createClient();
  const { data: allCompaniesRaw } = await supabase
    .from("companies")
    .select("id, slug, name, founder_email")
    .is("archived_at", null)
    .order("name");
  const allCompanies = (allCompaniesRaw ?? []).map((c: any) => ({
    id: c.id, slug: c.slug, name: c.name, founderEmail: c.founder_email,
  }));

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
      metricKey: f.metricKey ?? null,
      metricDefinitionId: f.metricDefinitionId ?? null,
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
        metricDefinitions={metricDefinitions}
      />
      <div className="px-8 max-w-5xl pb-12">
        <ScheduleEditor
          formSlug={form.slug}
          formName={form.name}
          initial={schedule}
          initialReminders={reminders}
          initialRecipients={recipientsWithEmails}
          allCompanies={allCompanies}
        />
      </div>
    </div>
  );
}
