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

  // L.20 — emit a value event for the receiving GP's org. Anonymous submission
  // so we can't auth the user; we resolve the org via the company slug and
  // insert directly (the SECURITY DEFINER RPC above already enforced gating).
  try {
    const { data: comp } = await supabase
      .from("companies")
      .select("organization_id")
      .eq("slug", input.companySlug)
      .maybeSingle();
    if (comp?.organization_id) {
      await supabase.from("usage_events").insert({
        organization_id: comp.organization_id,
        kind: "form_received" as const,
        metadata: { form_slug: input.formSlug, company_slug: input.companySlug, ai_extracted: input.aiExtracted } as any,
      });
    }
  } catch (err) {
    console.error("[L.20] form-received event log failed:", err);
  }

  return { ok: true, id: data as string };
}
