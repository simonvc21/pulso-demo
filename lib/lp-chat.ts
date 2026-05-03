// L.5c — LP ↔ GP chat thread loader. Server-only.

import { createClient } from "@/lib/supabase/server";

export interface LpChatMessage {
  id: string;
  lpId: string;
  body: string;
  createdAt: string;
  authorRole: "lp" | "gp" | "other";
  authorName: string | null;
  authorEmail: string | null;
  isCurrentUser: boolean;
}

export interface LpThreadSummary {
  lpId: string;
  lpName: string;
  unreadFromLp: number;
  lastMessageAt: string | null;
  lastBodyPreview: string;
}

export async function getLpThread(lpId: string): Promise<LpChatMessage[]> {
  const supabase = createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  let currentUserId: string | null = null;
  if (authUser) {
    const { data: prof } = await supabase
      .from("users")
      .select("id")
      .eq("auth_user_id", authUser.id)
      .maybeSingle();
    currentUserId = prof?.id ?? null;
  }

  const { data } = await (supabase as any)
    .from("lp_messages")
    .select("id, lp_id, body, created_at, author_user_id, users:author_user_id(name, email, role)")
    .eq("lp_id", lpId)
    .order("created_at", { ascending: true });

  return ((data ?? []) as any[]).map((r) => {
    const u = r.users ?? {};
    const role: LpChatMessage["authorRole"] =
      u.role === "lp" ? "lp" :
      ["gp", "managing_partner", "partner"].includes(u.role) ? "gp" : "other";
    return {
      id: r.id,
      lpId: r.lp_id,
      body: r.body,
      createdAt: r.created_at,
      authorRole: role,
      authorName: u.name ?? null,
      authorEmail: u.email ?? null,
      isCurrentUser: currentUserId != null && r.author_user_id === currentUserId,
    };
  });
}

/** All LP threads in the GP's org with last-message preview. */
export async function listLpThreads(): Promise<LpThreadSummary[]> {
  const supabase = createClient();
  const { data: lps } = await supabase
    .from("lps")
    .select("id, name");
  if (!lps || lps.length === 0) return [];

  const lpIds = lps.map((l) => l.id);
  const { data: msgs } = await (supabase as any)
    .from("lp_messages")
    .select("id, lp_id, body, created_at, read_by_other_at, users:author_user_id(role)")
    .in("lp_id", lpIds)
    .order("created_at", { ascending: false });

  const byLp = new Map<string, any[]>();
  for (const m of (msgs ?? []) as any[]) {
    const arr = byLp.get(m.lp_id) ?? [];
    arr.push(m);
    byLp.set(m.lp_id, arr);
  }

  return lps.map((l) => {
    const thread = byLp.get(l.id) ?? [];
    const last = thread[0];
    const unreadFromLp = thread.filter(
      (m: any) => m.users?.role === "lp" && !m.read_by_other_at
    ).length;
    return {
      lpId: l.id,
      lpName: l.name,
      unreadFromLp,
      lastMessageAt: last?.created_at ?? null,
      lastBodyPreview: last?.body?.slice(0, 120) ?? "",
    };
  }).sort((a, b) => {
    if (a.unreadFromLp !== b.unreadFromLp) return b.unreadFromLp - a.unreadFromLp;
    if (a.lastMessageAt && b.lastMessageAt) return b.lastMessageAt.localeCompare(a.lastMessageAt);
    if (a.lastMessageAt) return -1;
    if (b.lastMessageAt) return 1;
    return a.lpName.localeCompare(b.lpName);
  });
}

/** For an LP user: find the lp.id tied to their email. */
export async function getCurrentUsersLpId(): Promise<string | null> {
  const supabase = createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser?.email) return null;
  const { data: lp } = await supabase
    .from("lps")
    .select("id")
    .ilike("email", authUser.email)
    .maybeSingle();
  return lp?.id ?? null;
}
