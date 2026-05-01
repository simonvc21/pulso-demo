"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type FundProfileInput = {
  name: string;
  vintage: number | null;
  sizeUsd: number | null;
  deployedUsd: number | null;
  currency: string;
};

export type UpdateFundResult = { ok: true } | { ok: false; error: string };

export async function updateFund(input: FundProfileInput): Promise<UpdateFundResult> {
  if (!input.name.trim()) return { ok: false, error: "Fund name is required" };
  if (input.vintage != null && (input.vintage < 1900 || input.vintage > 2100)) {
    return { ok: false, error: "Vintage must be a sensible year" };
  }
  if (input.sizeUsd != null && input.sizeUsd < 0) {
    return { ok: false, error: "Fund size must be ≥ 0" };
  }
  if (input.deployedUsd != null && input.deployedUsd < 0) {
    return { ok: false, error: "Deployed must be ≥ 0" };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: userRow } = await supabase
    .from("users")
    .select("organization_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!userRow?.organization_id) {
    return { ok: false, error: "Your account isn't assigned to a fund yet." };
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      name: input.name.trim(),
      vintage: input.vintage,
      size_usd: input.sizeUsd,
      deployed_usd: input.deployedUsd,
      currency: input.currency || "USD",
    })
    .eq("id", userRow.organization_id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
  return { ok: true };
}
