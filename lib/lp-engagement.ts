// L.22 — LP engagement: comments + reactions on company pages.
// Server-only. Imported by /companies/[slug] (GP) and /lp/companies/[slug] (LP).

import { createClient } from "@/lib/supabase/server";

export type ReactionKind = "clap" | "rocket" | "concerned" | "thinking";

export const REACTION_LABELS: Record<ReactionKind, { emoji: string; label: string }> = {
  clap:       { emoji: "👏", label: "Nicely done" },
  rocket:     { emoji: "🚀", label: "Huge milestone" },
  concerned:  { emoji: "😬", label: "Worried" },
  thinking:   { emoji: "🤔", label: "Need more info" },
};

export interface CompanyComment {
  id: string;
  body: string;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
    email: string | null;
    role: string | null;
    isLp: boolean;
  };
  hidden: boolean;
}

export interface ReactionSummary {
  kind: ReactionKind;
  count: number;
  /** Whether the current user has this reaction. */
  mine: boolean;
}

export async function getCompanyComments(companyId: string, limit = 100): Promise<CompanyComment[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("company_comments")
    .select("id, body, created_at, hidden, author_user_id, users!company_comments_author_user_id_fkey(id, name, email, role)")
    .eq("company_id", companyId)
    .eq("hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.created_at,
    hidden: r.hidden,
    author: {
      id: r.users?.id ?? r.author_user_id,
      name: r.users?.name ?? null,
      email: r.users?.email ?? null,
      role: r.users?.role ?? null,
      isLp: r.users?.role === "lp",
    },
  }));
}

export async function getCompanyReactions(companyId: string): Promise<ReactionSummary[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let myUserId: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    myUserId = profile?.id ?? null;
  }

  const { data } = await supabase
    .from("company_reactions")
    .select("kind, user_id")
    .eq("company_id", companyId);

  // Aggregate counts + flag whether current user has each kind.
  const counts = new Map<ReactionKind, { count: number; mine: boolean }>();
  for (const r of (data ?? []) as any[]) {
    const cur = counts.get(r.kind) ?? { count: 0, mine: false };
    cur.count += 1;
    if (myUserId && r.user_id === myUserId) cur.mine = true;
    counts.set(r.kind, cur);
  }
  // Always return all 4 reaction kinds (even if 0) so the bar renders.
  return (Object.keys(REACTION_LABELS) as ReactionKind[]).map((k) => ({
    kind: k,
    count: counts.get(k)?.count ?? 0,
    mine: counts.get(k)?.mine ?? false,
  }));
}
