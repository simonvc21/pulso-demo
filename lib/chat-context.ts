// Build the "world dump" we feed to Gemini for every chat turn.
//
// For the 8-company seed (and even 50-company funds) this fits comfortably
// in the model context. We'll switch to RAG/pgvector when fund datasets
// get bigger or when we add per-company doc uploads.

import { createClient } from "@/lib/supabase/server";

export interface ChatContext {
  scope: "gp" | "lp" | "viewer";
  user: { name: string | null; email: string; role: string };
  organization: { id: string; name: string; vintage: number | null; size_usd: number; deployed_usd: number; currency: string } | null;
  companies: Array<{
    slug: string;
    name: string;
    sector: string | null;
    country: string | null;
    stage: string;
    status: string;
    invested_usd: number;
    ownership_pct: number;
    flag: string | null;
    description: string | null;
    founder: { name: string | null; email: string | null; role: string | null };
    metrics: Array<{
      quarter: string;
      arr_usd: number | null;
      burn_usd: number | null;
      cash_usd: number | null;
      revenue_usd: number | null;
      headcount: number | null;
    }>;
    latest_news: Array<{ submitted_at: string; field: string; text: string }>;
  }>;
  lps: Array<{ name: string; type: string; commitment_usd: number; country: string | null }>;
  forms: Array<{ slug: string; name: string; cadence: string; field_count: number; response_rate: number; last_sent_at: string | null }>;
  recent_alerts: Array<{ kind: string; title: string; body: string | null; created_at: string }>;
  generated_at: string;
}

/** Build the LLM context for the currently-authenticated user. RLS already
 *  scopes everything to their org; for LPs we narrow more (no LP roster). */
export async function buildChatContext(): Promise<ChatContext | null> {
  const supabase = createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("email, name, role, organization_id")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();

  const role = (profile?.role ?? "viewer") as string;
  const scope: ChatContext["scope"] = role === "lp" ? "lp" : role === "viewer" ? "viewer" : "gp";

  const orgId = profile?.organization_id ?? null;
  if (!orgId) {
    return {
      scope,
      user: { name: profile?.name ?? null, email: profile?.email ?? authUser.email ?? "", role },
      organization: null,
      companies: [], lps: [], forms: [], recent_alerts: [],
      generated_at: new Date().toISOString(),
    };
  }

  const [
    { data: orgRow },
    { data: companies },
    { data: lps },
    { data: forms },
    { data: alerts },
  ] = await Promise.all([
    supabase.from("organizations").select("id, name, vintage, size_usd, deployed_usd, currency").eq("id", orgId).maybeSingle(),
    supabase
      .from("companies")
      .select(
        "slug, name, sector, country, stage, status, invested_usd, ownership_pct, flag, description, " +
        "founder_name, founder_email, founder_role, " +
        "metrics(quarter, arr_usd, burn_usd, cash_usd, revenue_usd, headcount)"
      ),
    scope === "lp" ? Promise.resolve({ data: [] }) : supabase
      .from("lps")
      .select("name, type, commitment_usd, country"),
    scope === "lp" ? Promise.resolve({ data: [] }) : supabase
      .from("forms")
      .select("slug, name, cadence, fields_json, response_rate, last_sent_at, active")
      .eq("active", true),
    scope === "lp" ? Promise.resolve({ data: [] }) : supabase
      .from("notifications")
      .select("kind, title, body, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  // Pull recent news submissions to attach to each company
  const companiesById = new Map<string, ChatContext["companies"][number]>();
  const companiesArr: ChatContext["companies"] = [];

  for (const c of (companies ?? []) as any[]) {
    const sortedMetrics = ((c.metrics ?? []) as any[])
      .sort((a, b) => a.quarter.localeCompare(b.quarter))
      .map((m) => ({
        quarter: m.quarter,
        arr_usd: m.arr_usd, burn_usd: m.burn_usd, cash_usd: m.cash_usd,
        revenue_usd: m.revenue_usd, headcount: m.headcount,
      }));
    const entry: ChatContext["companies"][number] = {
      slug: c.slug, name: c.name, sector: c.sector, country: c.country,
      stage: c.stage, status: c.status,
      invested_usd: Number(c.invested_usd ?? 0),
      ownership_pct: Number(c.ownership_pct ?? 0),
      flag: c.flag, description: c.description,
      founder: { name: c.founder_name, email: c.founder_email, role: c.founder_role },
      metrics: sortedMetrics,
      latest_news: [],
    };
    companiesArr.push(entry);
    companiesById.set(c.slug, entry);
  }

  // Newsletter feed: limit to most recent 24 updates total (across companies)
  const { data: subs } = await supabase
    .from("form_submissions")
    .select("submitted_at, data_json, companies(slug), forms(fields_json)")
    .order("submitted_at", { ascending: false })
    .limit(60);

  for (const s of (subs ?? []) as any[]) {
    const fields = Array.isArray(s.forms?.fields_json) ? s.forms.fields_json : [];
    const newsFields = fields.filter((f: any) => f.type === "news" || (f.type === "longtext" && /(news|update|milestone|press|wins?)/i.test(`${f.group ?? ""} ${f.label ?? ""}`)));
    if (newsFields.length === 0) continue;
    const slug = s.companies?.slug;
    const target = slug ? companiesById.get(slug) : null;
    if (!target) continue;
    for (const f of newsFields) {
      const raw = (s.data_json ?? {})[f.id];
      const text = typeof raw === "string" ? raw.trim() : "";
      if (!text) continue;
      target.latest_news.push({ submitted_at: s.submitted_at, field: f.label, text });
      if (target.latest_news.length >= 4) break;
    }
  }

  return {
    scope,
    user: { name: profile?.name ?? null, email: profile?.email ?? authUser.email ?? "", role },
    organization: orgRow ? {
      id: orgRow.id, name: orgRow.name,
      vintage: orgRow.vintage,
      size_usd: Number(orgRow.size_usd ?? 0),
      deployed_usd: Number(orgRow.deployed_usd ?? 0),
      currency: orgRow.currency ?? "USD",
    } : null,
    companies: companiesArr,
    lps: ((lps ?? []) as any[]).map((l) => ({
      name: l.name, type: l.type,
      commitment_usd: Number(l.commitment_usd ?? 0),
      country: l.country,
    })),
    forms: ((forms ?? []) as any[]).map((f) => ({
      slug: f.slug, name: f.name, cadence: f.cadence,
      field_count: Array.isArray(f.fields_json) ? f.fields_json.length : 0,
      response_rate: Number(f.response_rate ?? 0),
      last_sent_at: f.last_sent_at,
    })),
    recent_alerts: ((alerts ?? []) as any[]).map((a) => ({
      kind: a.kind, title: a.title, body: a.body, created_at: a.created_at,
    })),
    generated_at: new Date().toISOString(),
  };
}

/** Compact JSON serialization for the system prompt. Trims absurdly long
 *  description / news fields to keep token count bounded. */
export function serializeContextForPrompt(ctx: ChatContext): string {
  const trimText = (s: string | null | undefined, max = 600): string | null => {
    if (!s) return null;
    return s.length > max ? s.slice(0, max) + "…" : s;
  };

  const out = {
    scope: ctx.scope,
    user: ctx.user,
    organization: ctx.organization,
    companies: ctx.companies.map((c) => ({
      ...c,
      description: trimText(c.description, 300),
      latest_news: c.latest_news.map((n) => ({ ...n, text: trimText(n.text, 800) })),
    })),
    lps: ctx.lps,
    forms: ctx.forms,
    recent_alerts: ctx.recent_alerts.map((a) => ({ ...a, body: trimText(a.body, 400) })),
    generated_at: ctx.generated_at,
  };
  return JSON.stringify(out);
}
