// L.11 — Founder one-active-form lookup. Server-only.

import { createClient } from "@/lib/supabase/server";

export type ActiveFormStatus = "pending" | "submitted" | "overdue";

export interface ActiveFormSummary {
  id: string;
  companyId: string;
  formId: string;
  formSlug: string;
  formName: string;
  dueAt: string | null;
  periodLabel: string | null;
  status: ActiveFormStatus;
  isExtra: boolean;
}

/** Look up the active form for a single company. Returns null if none assigned. */
export async function getActiveFormForCompany(companyId: string): Promise<ActiveFormSummary | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("company_active_form")
    .select("id, company_id, form_id, due_at, period_label, status, is_extra, forms(slug, name)")
    .eq("company_id", companyId)
    .maybeSingle();
  if (!data) return null;
  const f = (data as any).forms;
  return {
    id: data.id,
    companyId: data.company_id,
    formId: data.form_id,
    formSlug: f?.slug ?? "",
    formName: f?.name ?? "Untitled form",
    dueAt: data.due_at,
    periodLabel: data.period_label,
    status: data.status,
    isExtra: data.is_extra,
  };
}

/** Same lookup by company slug — used by /fill resolution. */
export async function getActiveFormForCompanySlug(companySlug: string): Promise<ActiveFormSummary | null> {
  const supabase = createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("slug", companySlug)
    .maybeSingle();
  if (!company) return null;
  return getActiveFormForCompany(company.id);
}

/** Auto-mark overdue: any pending row past due_at. Cheap to call from
 *  loaders that show status badges. */
export function effectiveStatus(s: ActiveFormSummary): ActiveFormStatus {
  if (s.status === "submitted") return "submitted";
  if (s.dueAt && new Date(s.dueAt).getTime() < Date.now()) return "overdue";
  return s.status;
}

export function formatDueIn(iso: string | null): string {
  if (!iso) return "no due date";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) {
    const days = Math.floor(-ms / (24 * 60 * 60 * 1000));
    return days === 0 ? "due today" : `${days}d overdue`;
  }
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days === 0) return "due today";
  if (days < 7) return `due in ${days}d`;
  return `due ${new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}
