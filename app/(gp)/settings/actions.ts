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
  description?: string | null;
  thesis?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
  foundedYear?: number | null;
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
      description: input.description?.trim() || null,
      thesis: input.thesis?.trim() || null,
      website: input.website?.trim() || null,
      linkedin_url: input.linkedinUrl?.trim() || null,
      founded_year: input.foundedYear,
    })
    .eq("id", userRow.organization_id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Branding: logo upload + theme colors
// ---------------------------------------------------------------------------

const HEX = /^#[0-9a-fA-F]{6}$/;

async function requireOrg() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };
  const { data: row } = await supabase
    .from("users")
    .select("organization_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!row?.organization_id) return { ok: false as const, error: "No fund assigned" };
  return { ok: true as const, supabase, organizationId: row.organization_id };
}

export type ThemeInput = {
  primary?: string | null; // hex like "#0A1F44"
  accent?: string | null;
  navy?: string | null;
};

export type ThemeResult = { ok: true } | { ok: false; error: string };

export async function updateOrgTheme(input: ThemeInput): Promise<ThemeResult> {
  const ctx = await requireOrg();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const theme: Record<string, string> = {};
  for (const k of ["primary", "accent", "navy"] as const) {
    const v = input[k];
    if (!v) continue;
    if (!HEX.test(v)) return { ok: false, error: `Invalid hex color for ${k}` };
    theme[k] = v.toLowerCase();
  }

  const { error } = await ctx.supabase
    .from("organizations")
    .update({ theme_json: theme })
    .eq("id", ctx.organizationId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export type UploadLogoResult = { ok: true; url: string } | { ok: false; error: string };

/** Uploads a base64 data URL (image/png|jpeg|webp|svg) for the org. The path
 *  encodes the org id so RLS on storage.objects matches the caller. */
export async function uploadOrgLogo(dataUrl: string): Promise<UploadLogoResult> {
  const ctx = await requireOrg();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return { ok: false, error: "Invalid image data" };
  if (parsed.bytes.byteLength > 1_500_000) return { ok: false, error: "Logo must be < 1.5MB" };

  const ext = extFromMime(parsed.mime);
  if (!ext) return { ok: false, error: "Use PNG, JPG, WEBP, or SVG" };

  const path = `org/${ctx.organizationId}/logo-${Date.now()}.${ext}`;
  const up = await ctx.supabase.storage.from("org-assets").upload(path, parsed.bytes, {
    contentType: parsed.mime,
    upsert: false,
  });
  if (up.error) return { ok: false, error: up.error.message };

  const { data: pub } = ctx.supabase.storage.from("org-assets").getPublicUrl(path);
  const url = pub.publicUrl;

  const { error } = await ctx.supabase
    .from("organizations")
    .update({ logo_url: url })
    .eq("id", ctx.organizationId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true, url };
}

export async function uploadCompanyLogo(companySlug: string, dataUrl: string): Promise<UploadLogoResult> {
  const ctx = await requireOrg();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return { ok: false, error: "Invalid image data" };
  if (parsed.bytes.byteLength > 1_500_000) return { ok: false, error: "Logo must be < 1.5MB" };

  const ext = extFromMime(parsed.mime);
  if (!ext) return { ok: false, error: "Use PNG, JPG, WEBP, or SVG" };

  // Resolve the company within the caller's org (RLS enforces it too).
  const { data: c } = await ctx.supabase
    .from("companies")
    .select("id, slug")
    .eq("slug", companySlug)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!c) return { ok: false, error: "Company not found in this fund" };

  const path = `org/${ctx.organizationId}/company-${c.slug}-${Date.now()}.${ext}`;
  const up = await ctx.supabase.storage.from("org-assets").upload(path, parsed.bytes, {
    contentType: parsed.mime,
    upsert: false,
  });
  if (up.error) return { ok: false, error: up.error.message };

  const { data: pub } = ctx.supabase.storage.from("org-assets").getPublicUrl(path);
  const url = pub.publicUrl;

  const { error } = await ctx.supabase
    .from("companies")
    .update({ logo_url: url })
    .eq("id", c.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true, url };
}

function parseDataUrl(s: string): { mime: string; bytes: Uint8Array } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(s);
  if (!match) return null;
  try {
    const buf = Buffer.from(match[2], "base64");
    return { mime: match[1], bytes: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) };
  } catch {
    return null;
  }
}

function extFromMime(mime: string): string | null {
  switch (mime) {
    case "image/png": return "png";
    case "image/jpeg": return "jpg";
    case "image/webp": return "webp";
    case "image/svg+xml": return "svg";
    default: return null;
  }
}
