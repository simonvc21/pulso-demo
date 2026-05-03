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

export default async function EditFormPage({
  params, searchParams,
}: { params: { id: string }; searchParams: { from?: string } }) {
  const form = await getFormBySlug(params.id);
  if (!form) notFound();
  const fromCreate = searchParams?.from === "create";

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
  const { data: allCompaniesRaw } = await (supabase as any)
    .from("companies")
    .select("id, slug, name, founder_email, founder_emails")
    .is("archived_at", null)
    .order("name");
  const allCompanies = (allCompaniesRaw ?? []).map((c: any) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    founderEmail: c.founder_email,
    founderEmails: (c.founder_emails ?? []) as string[],
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
      {fromCreate && (
        <div className="px-8 pt-6 max-w-5xl">
          <div className="rounded-xl border border-teal/40 bg-teal/5 px-4 py-3 flex items-start gap-3">
            <div className="text-2xl leading-none">✓</div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-ink">Form created</div>
              <p className="text-[12px] text-muted mt-0.5">
                Now scroll down to the <strong>Schedule</strong> section to pick when this form sends, who receives it, and what the reminders say.
              </p>
            </div>
            <a href="#schedule" className="text-[12px] text-teal-600 font-semibold hover:underline shrink-0">
              Jump to schedule ↓
            </a>
          </div>
        </div>
      )}
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
