// L.4e — Per-company fill tokens. Server-only.
//
// `resolveFillToken` runs anonymously from the /fill page.
// `listCompanyFillTokens` and `revokeFillToken` run from the GP-side
// founder-link UX.

import { createClient } from "@/lib/supabase/server";

export interface ResolvedFillToken {
  companyId: string;
  companySlug: string;
  organizationId: string;
}

export async function resolveFillToken(token: string): Promise<ResolvedFillToken | null> {
  if (!token || token.length < 16) return null;
  const supabase = createClient();
  const { data, error } = await (supabase as any).rpc("resolve_fill_token", { p_token: token });
  if (error) return null;
  const row = (data ?? [])[0] as any;
  if (!row?.company_id) return null;
  return {
    companyId: row.company_id,
    companySlug: row.company_slug,
    organizationId: row.organization_id,
  };
}

export async function companyHasFillToken(companyId: string): Promise<boolean> {
  const supabase = createClient();
  const { count } = await (supabase as any)
    .from("company_fill_tokens")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .is("revoked_at", null);
  return (count ?? 0) > 0;
}

export interface FillTokenRow {
  id: string;
  token: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  useCount: number;
}

export async function listCompanyFillTokens(companyId: string): Promise<FillTokenRow[]> {
  const supabase = createClient();
  const { data } = await (supabase as any)
    .from("company_fill_tokens")
    .select("id, token, label, created_at, last_used_at, use_count")
    .eq("company_id", companyId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r: any) => ({
    id: r.id,
    token: r.token,
    label: r.label,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
    useCount: r.use_count ?? 0,
  }));
}
