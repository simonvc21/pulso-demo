"use server";

// L.10 / Fase 1.A — Server actions for columns and rows on a company's sheet.
// One sheet per company is enforced by DB constraint, so the sheet is
// created lazily by the page on first visit. We don't expose create/rename/
// delete sheet actions because there's only ever one and it can't be
// removed without removing the company.

import { revalidatePath } from "next/cache";
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

  await revalidateForSheet(sheetId);
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

  await revalidateForSheet(col.sheet_id);
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

  // Orphan keys in sheet_rows.data referencing the deleted column stay put;
  // they're invisible and a Fase 2 cleanup script can reap them.

  await revalidateForSheet(col.sheet_id);
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

  await revalidateForSheet(sheetId);
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

  await revalidateForSheet(existing.sheet_id);
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

  await revalidateForSheet(existing.sheet_id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function revalidateForSheet(sheetId: string): Promise<void> {
  const supabase = createClient();
  const { data } = await supabase
    .from("sheets")
    .select("companies(slug)")
    .eq("id", sheetId)
    .maybeSingle();
  const slug = (data as any)?.companies?.slug;
  if (slug) revalidatePath(`/companies/${slug}`);
}
