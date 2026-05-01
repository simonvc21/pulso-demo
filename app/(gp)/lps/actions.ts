"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type LpType = Database["public"]["Enums"]["lp_type"];

export type AddLpInput = {
  name: string;
  type: LpType;
  commitmentUsd: number;
  country: string | null;
  email: string | null;
};

export type AddLpResult = { ok: true; id: string } | { ok: false; error: string };

export async function addLp(input: AddLpInput): Promise<AddLpResult> {
  if (!input.name.trim()) return { ok: false, error: "Name is required" };
  if (!Number.isFinite(input.commitmentUsd) || input.commitmentUsd < 0) {
    return { ok: false, error: "Commitment must be a positive number" };
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

  const { data, error } = await supabase
    .from("lps")
    .insert({
      organization_id: userRow.organization_id,
      name: input.name.trim(),
      type: input.type,
      commitment_usd: Math.round(input.commitmentUsd),
      country: input.country?.trim() || null,
      email: input.email?.trim() || null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/lps");
  return { ok: true, id: data.id };
}
