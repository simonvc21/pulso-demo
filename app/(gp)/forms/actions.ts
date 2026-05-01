"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type Cadence = Database["public"]["Enums"]["form_cadence"];

export type DraftField = {
  id: string;
  type: "currency" | "number" | "percent" | "text" | "longtext" | "select" | "date";
  label: string;
  required?: boolean;
  group?: string;
};

export type CreateFormInput = {
  name: string;
  cadence: "monthly" | "quarterly" | "annual" | "ad-hoc";
  fields: DraftField[];
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export type CreateFormResult = { ok: true; slug: string } | { ok: false; error: string };

export async function createForm(input: CreateFormInput): Promise<CreateFormResult> {
  if (!input.name.trim()) return { ok: false, error: "Name is required" };
  if (input.fields.length === 0) return { ok: false, error: "Add at least one field" };

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

  const cadenceDb: Cadence = input.cadence === "ad-hoc" ? "ad_hoc" : (input.cadence as Cadence);

  // Make slug unique by appending a short suffix if collision
  const baseSlug = slugify(input.name) || "form";
  let finalSlug = baseSlug;
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await supabase
      .from("forms")
      .select("id")
      .eq("slug", finalSlug)
      .eq("organization_id", userRow.organization_id)
      .maybeSingle();
    if (!existing) break;
    finalSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const { error } = await supabase.from("forms").insert({
    organization_id: userRow.organization_id,
    slug: finalSlug,
    name: input.name.trim(),
    cadence: cadenceDb,
    fields_json: input.fields as any,
    active: true,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/forms");
  redirect(`/forms/${finalSlug}`);
}
