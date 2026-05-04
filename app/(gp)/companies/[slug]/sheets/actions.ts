"use server";

// L.10 / Fase 1.4 — Server actions for the sheets / columns / rows model.
// Thin wrappers over Postgres. RLS does the org filtering — we don't second-
// guess it here. Each action revalidates the affected sheet page so the UI
// reflects the change without a manual refresh.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ColumnType =
  | "text"
  | "long_text"
  | "number"
  | "currency"
  | "percent"
  | "date"
  | "single_select"
  | "checkbox"
  | "attachment_url";

export type ActionResult<T = void> =
  | ({ ok: true } & (T extends void ? {} : { data: T }))
  | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

// ---------------------------------------------------------------------------
// Sheets
// ---------------------------------------------------------------------------

export async function createSheet(
  companyId: string,
  name: string,
): Promise<ActionResult<{ id: string; companySlug: string }>> {
  const trimmed = name.trim();
  if (!trimmed) return fail("Sheet name is required");
  if (trimmed.length > 80) return fail("Sheet name too long");

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Not authenticated");

  // Resolve the public.users row + verify the company belongs to the caller's org.
  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!profile) return fail("User profile not found");

  // Look up company slug for the redirect target. RLS gates org access.
  const { data: company } = await supabase
    .from("companies")
    .select("slug")
    .eq("id", companyId)
    .maybeSingle();
  if (!company) return fail("Company not found");

  // Position = current max + 1.
  const { data: existing } = await supabase
    .from("sheets")
    .select("position")
    .eq("company_id", companyId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (existing?.position ?? -1) + 1;

  const { data: row, error } = await supabase
    .from("sheets")
    .insert({
      company_id: companyId,
      name: trimmed,
      position,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error || !row) return fail(error?.message ?? "Could not create sheet");

  revalidatePath(`/companies/${company.slug}`);
  return { ok: true, data: { id: row.id, companySlug: company.slug } };
}

export async function renameSheet(
  sheetId: string,
  name: string,
): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return fail("Sheet name is required");
  if (trimmed.length > 80) return fail("Sheet name too long");

  const supabase = createClient();
  const { data: sheet } = await supabase
    .from("sheets")
    .select("company_id, companies(slug)")
    .eq("id", sheetId)
    .maybeSingle();
  if (!sheet) return fail("Sheet not found");

  const { error } = await supabase
    .from("sheets")
    .update({ name: trimmed, updated_at: new Date().toISOString() })
    .eq("id", sheetId);
  if (error) return fail(error.message);

  const slug = (sheet as any).companies?.slug;
  if (slug) {
    revalidatePath(`/companies/${slug}`);
    revalidatePath(`/companies/${slug}/sheets/${sheetId}`);
  }
  return { ok: true };
}

export async function deleteSheet(
  sheetId: string,
): Promise<ActionResult<{ companySlug: string | null }>> {
  const supabase = createClient();
  const { data: sheet } = await supabase
    .from("sheets")
    .select("company_id, companies(slug)")
    .eq("id", sheetId)
    .maybeSingle();
  if (!sheet) return fail("Sheet not found");

  const slug = (sheet as any).companies?.slug ?? null;

  const { error } = await supabase
    .from("sheets")
    .delete()
    .eq("id", sheetId);
  if (error) return fail(error.message);

  if (slug) revalidatePath(`/companies/${slug}`);
  return { ok: true, data: { companySlug: slug } };
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

const ALLOWED_TYPES = new Set<ColumnType>([
  "text", "long_text", "number", "currency", "percent",
  "date", "single_select", "checkbox", "attachment_url",
]);

export async function addColumn(
  sheetId: string,
  type: ColumnType,
  name: string,
  config: Record<string, any> = {},
): Promise<ActionResult<{ id: string }>> {
  const trimmed = name.trim();
  if (!trimmed) return fail("Column name is required");
  if (trimmed.length > 60) return fail("Column name too long");
  if (!ALLOWED_TYPES.has(type)) return fail(`Unsupported column type: ${type}`);

  const supabase = createClient();
  const { data: existing } = await supabase
    .from("sheet_columns")
    .select("position")
    .eq("sheet_id", sheetId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (existing?.position ?? -1) + 1;

  const { data: row, error } = await supabase
    .from("sheet_columns")
    .insert({ sheet_id: sheetId, name: trimmed, type, config: config as any, position })
    .select("id")
    .single();
  if (error || !row) return fail(error?.message ?? "Could not add column");

  await revalidateSheet(sheetId);
  return { ok: true, data: { id: row.id } };
}

export interface ColumnPatch {
  name?: string;
  type?: ColumnType;
  config?: Record<string, any>;
  position?: number;
}

export async function updateColumn(
  columnId: string,
  patch: ColumnPatch,
): Promise<ActionResult> {
  const supabase = createClient();
  const update: Record<string, any> = {};
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) return fail("Column name is required");
    if (trimmed.length > 60) return fail("Column name too long");
    update.name = trimmed;
  }
  if (patch.type !== undefined) {
    if (!ALLOWED_TYPES.has(patch.type)) return fail(`Unsupported column type: ${patch.type}`);
    update.type = patch.type;
  }
  if (patch.config !== undefined) update.config = patch.config;
  if (patch.position !== undefined) update.position = patch.position;
  if (Object.keys(update).length === 0) return { ok: true };

  const { data: col } = await supabase
    .from("sheet_columns")
    .select("sheet_id")
    .eq("id", columnId)
    .maybeSingle();
  if (!col) return fail("Column not found");

  const { error } = await supabase
    .from("sheet_columns")
    .update(update as any)
    .eq("id", columnId);
  if (error) return fail(error.message);

  await revalidateSheet(col.sheet_id);
  return { ok: true };
}

export async function deleteColumn(
  columnId: string,
): Promise<ActionResult> {
  const supabase = createClient();
  const { data: col } = await supabase
    .from("sheet_columns")
    .select("sheet_id")
    .eq("id", columnId)
    .maybeSingle();
  if (!col) return fail("Column not found");

  const { error } = await supabase
    .from("sheet_columns")
    .delete()
    .eq("id", columnId);
  if (error) return fail(error.message);

  // TODO Fase 2: clean up orphan keys in sheet_rows.data referencing the
  // deleted column. Spec §11 — leaving them for now since they're invisible.

  await revalidateSheet(col.sheet_id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export async function addRow(
  sheetId: string,
  data: Record<string, any> = {},
): Promise<ActionResult<{ id: string }>> {
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("sheet_rows")
    .select("position")
    .eq("sheet_id", sheetId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (existing?.position ?? -1) + 1;

  const { data: row, error } = await supabase
    .from("sheet_rows")
    .insert({ sheet_id: sheetId, data: data as any, position })
    .select("id")
    .single();
  if (error || !row) return fail(error?.message ?? "Could not add row");

  await revalidateSheet(sheetId);
  return { ok: true, data: { id: row.id } };
}

export async function updateRow(
  rowId: string,
  patch: Record<string, any>,
): Promise<ActionResult> {
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("sheet_rows")
    .select("sheet_id, data")
    .eq("id", rowId)
    .maybeSingle();
  if (!existing) return fail("Row not found");

  // Merge patch into existing data so partial updates don't clobber other cells.
  const merged = { ...((existing.data ?? {}) as Record<string, any>), ...patch };

  const { error } = await supabase
    .from("sheet_rows")
    .update({ data: merged as any, updated_at: new Date().toISOString() })
    .eq("id", rowId);
  if (error) return fail(error.message);

  await revalidateSheet(existing.sheet_id);
  return { ok: true };
}

export async function deleteRow(
  rowId: string,
): Promise<ActionResult> {
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("sheet_rows")
    .select("sheet_id")
    .eq("id", rowId)
    .maybeSingle();
  if (!existing) return fail("Row not found");

  const { error } = await supabase
    .from("sheet_rows")
    .delete()
    .eq("id", rowId);
  if (error) return fail(error.message);

  await revalidateSheet(existing.sheet_id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function revalidateSheet(sheetId: string): Promise<void> {
  const supabase = createClient();
  const { data } = await supabase
    .from("sheets")
    .select("id, companies(slug)")
    .eq("id", sheetId)
    .maybeSingle();
  const slug = (data as any)?.companies?.slug;
  if (slug) {
    revalidatePath(`/companies/${slug}`);
    revalidatePath(`/companies/${slug}/sheets/${sheetId}`);
  }
}
