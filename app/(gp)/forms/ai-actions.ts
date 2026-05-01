"use server";

import { gemini } from "@/lib/gemini";
import { createClient } from "@/lib/supabase/server";
import type { DraftField } from "./actions";

const VALID_TYPES = ["currency", "number", "percent", "text", "longtext", "select", "date", "news"] as const;
type FieldType = (typeof VALID_TYPES)[number];

function isFieldType(s: unknown): s is FieldType {
  return typeof s === "string" && (VALID_TYPES as readonly string[]).includes(s);
}

const SYSTEM_SUGGEST = `You are a portfolio reporting expert helping a LATAM venture capital fund design a form for their founders.
Output STRICT JSON matching this schema (no prose, no markdown, no fences):
{
  "fields": [
    {
      "id": "string (short snake_case)",
      "type": "currency|number|percent|text|longtext|select|date|news",
      "label": "string (clear question or instruction in English)",
      "group": "string (one of: P&L, Balance Sheet, Team, Product, Growth, Narrative, Updates)",
      "required": true|false,
      "options": ["string"]  // only when type='select', omit otherwise
    }
  ]
}

Rules:
- 6 to 10 fields. Standard VC quarterly metrics if the prompt is generic.
- Use 'currency' for any USD figure (revenue, ARR, burn, cash). 'percent' for margins/growth. 'number' for headcount.
- Always include at least one 'news' type field for narrative updates.
- 'longtext' for long-form qualitative ("biggest risk", "wins").
- Required only for true must-haves (revenue, ARR, burn, cash, headcount).
- Group fields logically. Keep labels under 80 chars.`;

interface SuggestPayload {
  fields: Array<{
    id?: string;
    type?: string;
    label?: string;
    group?: string;
    required?: boolean;
    options?: string[];
  }>;
}

async function ensureGpAndBump(): Promise<{ ok: false; error: string } | { ok: true }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("users")
    .select("organization_id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile?.organization_id) return { ok: false, error: "No fund assigned" };

  // Reuse the chat cap for now (150/day); cheap enough since these are rare.
  const { data: count } = await supabase.rpc("bump_ai_usage", {
    p_org: profile.organization_id,
    p_feature: "form_helper",
  });
  if (typeof count === "number" && count > 60) {
    return { ok: false, error: "Daily AI quota for form helper reached. Resets at 00:00 UTC." };
  }
  return { ok: true };
}

function sanitize(raw: SuggestPayload): DraftField[] {
  const out: DraftField[] = [];
  const usedIds = new Set<string>();
  let i = 0;
  for (const f of raw.fields ?? []) {
    if (!f.label || !isFieldType(f.type)) continue;
    let id = (f.id ?? "").toString().toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 30);
    if (!id || usedIds.has(id)) id = `f${Date.now()}_${i++}`;
    usedIds.add(id);
    const field: DraftField = {
      id,
      type: f.type as DraftField["type"],
      label: String(f.label).slice(0, 120),
      required: Boolean(f.required),
      group: f.group ? String(f.group).slice(0, 30) : undefined,
    };
    if (field.type === "select" && Array.isArray(f.options) && f.options.length > 0) {
      field.options = f.options.map((o) => String(o)).filter(Boolean).slice(0, 12);
    }
    out.push(field);
    if (out.length >= 12) break;
  }
  return out;
}

export type SuggestFieldsResult =
  | { ok: true; fields: DraftField[] }
  | { ok: false; error: string };

export async function suggestFormFields(prompt: string): Promise<SuggestFieldsResult> {
  const clean = (prompt ?? "").toString().trim();
  if (!clean) return { ok: false, error: "Describe the form in one sentence." };
  if (clean.length > 600) return { ok: false, error: "Description too long" };

  const auth = await ensureGpAndBump();
  if (!auth.ok) return { ok: false, error: auth.error };

  try {
    const payload = await gemini.generateJSON<SuggestPayload>(
      `Form description: ${clean}`,
      {
        model: "flash",
        systemInstruction: SYSTEM_SUGGEST,
        temperature: 0.4,
        maxOutputTokens: 1500,
      }
    );
    const fields = sanitize(payload);
    if (fields.length === 0) return { ok: false, error: "AI didn't return any usable fields. Try rephrasing." };
    return { ok: true, fields };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Gemini failed" };
  }
}

export type RewriteFieldResult =
  | { ok: true; label: string }
  | { ok: false; error: string };

export async function rewriteFieldLabel(
  label: string,
  intent: "clearer" | "spanish" | "shorter"
): Promise<RewriteFieldResult> {
  const clean = (label ?? "").toString().trim();
  if (!clean) return { ok: false, error: "Empty label" };

  const auth = await ensureGpAndBump();
  if (!auth.ok) return { ok: false, error: auth.error };

  const instruction = {
    clearer: "Rewrite to be clearer and more direct, in English. Keep the same intent. One question, no preamble. Max 80 chars.",
    spanish: "Translate to professional Latin American Spanish. One question, no preamble. Max 80 chars.",
    shorter: "Rewrite as the shortest version that still asks the same thing. English. Max 50 chars.",
  }[intent];

  try {
    const text = await gemini.generate(
      `Original question: ${clean}\n\nReturn just the rewritten question. No quotes, no markdown.`,
      {
        model: "flash",
        systemInstruction: `You are a UX writer for portfolio reporting forms. ${instruction}`,
        temperature: 0.3,
        maxOutputTokens: 80,
      }
    );
    const cleaned = text.trim().replace(/^["'`]+|["'`]+$/g, "").slice(0, 120);
    if (!cleaned) return { ok: false, error: "Empty AI response" };
    return { ok: true, label: cleaned };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Gemini failed" };
  }
}
