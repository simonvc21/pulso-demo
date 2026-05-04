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

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export type DeleteLpResult = { ok: true } | { ok: false; error: string };

export async function deleteLp(lpId: string): Promise<DeleteLpResult> {
  if (!lpId) return { ok: false, error: "Missing id" };
  const supabase = createClient();
  // RLS gates by organization_id, so the delete is a no-op if the LP belongs
  // to someone else's org. We don't need to manually check membership here.
  const { error } = await supabase.from("lps").delete().eq("id", lpId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/lps");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Bulk import — CSV / Excel
// ---------------------------------------------------------------------------

const VALID_LP_TYPES: LpType[] = ["Family Office", "Institutional", "Fund of Funds", "Individual"];

function normalizeLpType(raw: string): LpType {
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned) return "Institutional";
  // Exact-ish matches first
  for (const t of VALID_LP_TYPES) {
    if (t.toLowerCase() === cleaned) return t;
  }
  // Loose matches
  if (/family/.test(cleaned)) return "Family Office";
  if (/fof|fund.of.funds/.test(cleaned)) return "Fund of Funds";
  if (/individual|angel|person/.test(cleaned)) return "Individual";
  return "Institutional";
}

export type BulkLpInput = {
  name: string;
  type: string;            // raw string, normalized server-side
  commitmentUsd: number | null;
  country: string | null;
  email: string | null;
  lineNumber: number;
};

export type BulkLpResult =
  | { ok: true; inserted: number; skipped: number; errors: string[] }
  | { ok: false; error: string };

export async function bulkImportLps(rows: BulkLpInput[]): Promise<BulkLpResult> {
  if (!rows || rows.length === 0) return { ok: false, error: "Nothing to import" };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  const { data: userRow } = await supabase
    .from("users")
    .select("organization_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!userRow?.organization_id) return { ok: false, error: "No fund assigned" };
  const orgId = userRow.organization_id;

  const errors: string[] = [];
  let skipped = 0;
  const inserts = rows
    .filter((r) => {
      if (!r.name?.trim()) { skipped++; errors.push(`Line ${r.lineNumber}: missing name`); return false; }
      return true;
    })
    .map((r) => ({
      organization_id: orgId,
      name: r.name.trim(),
      type: normalizeLpType(r.type),
      commitment_usd: r.commitmentUsd != null ? Math.round(r.commitmentUsd) : 0,
      country: r.country?.trim() || null,
      email: r.email?.trim().toLowerCase() || null,
    }));

  if (inserts.length === 0) {
    return { ok: true, inserted: 0, skipped, errors };
  }

  const { error } = await supabase.from("lps").insert(inserts);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/lps");
  return { ok: true, inserted: inserts.length, skipped, errors };
}
