"use server";

import { createClient } from "@/lib/supabase/server";

export type SubmitResult = { ok: true; id: string } | { ok: false; error: string };

export async function submitFillForm(input: {
  formSlug: string;
  companySlug: string;
  data: Record<string, string>;
  aiExtracted: boolean;
}): Promise<SubmitResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("submit_public_form", {
    p_form_slug: input.formSlug,
    p_company_slug: input.companySlug,
    p_data: input.data,
    p_ai_extracted: input.aiExtracted,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data as string };
}
