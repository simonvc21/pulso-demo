import { notFound } from "next/navigation";
import {
  getFormBySlug,
  getCompanyOptions,
  getFormRecipientIds,
  getFormSchedule,
  getFormReminders,
  getFormRecipientsWithEmails,
} from "@/lib/dashboard-data";
import { createClient } from "@/lib/supabase/server";
import { FormBuilder } from "../../form-builder";
import type { FormInput } from "../../actions";
import { ScheduleEditor } from "./schedule-editor";
import { ScrollToSchedule } from "./scroll-to-schedule";

export const dynamic = "force-dynamic";

export default async function EditFormPage({
  params, searchParams,
}: { params: { id: string }; searchParams: { from?: string } }) {
  const form = await getFormBySlug(params.id);
  if (!form) notFound();
  const fromCreate = searchParams?.from === "create";

  const [companies, recipientIds, schedule, reminders, recipientsWithEmails] = await Promise.all([
    getCompanyOptions(),
    getFormRecipientIds(form.id),
    getFormSchedule(form.id),
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
    })),
  };

  return (
    <div className="space-y-6">
      {fromCreate && (
        <div className="px-8 pt-6 max-w-5xl">
          <div className="bg-gradient-to-r from-teal-50 to-paper2/40 border border-teal/30 rounded-xl p-4">
            <div className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.14em] uppercase">
              <span className="inline-flex items-center gap-1.5 text-teal-600">
                <span className="h-5 w-5 rounded-full bg-teal-600 text-white text-[10px] flex items-center justify-center">✓</span>
                Step 1 · Fields
              </span>
              <span className="text-muted">→</span>
              <a href="#schedule" className="inline-flex items-center gap-1.5 text-ink hover:text-teal-600">
                <span className="h-5 w-5 rounded-full border-2 border-ink text-[10px] flex items-center justify-center font-bold">2</span>
                Step 2 · Schedule, recipients & reminders
              </a>
              <a href="#schedule" className="ml-auto text-[12px] font-semibold text-teal-600 hover:underline normal-case tracking-normal">
                Configure now ↓
              </a>
            </div>
            <p className="text-[12px] text-muted mt-2 leading-relaxed">
              Your form is saved. Now scroll down to set the day-of-month it auto-sends, who receives it
              (one or more emails per company), and customize each reminder's copy.
            </p>
          </div>
          <ScrollToSchedule />
        </div>
      )}
      <FormBuilder
        mode="edit"
        slug={form.slug}
        initial={initial}
        companies={companies}
        initialRecipientIds={recipientIds}
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
