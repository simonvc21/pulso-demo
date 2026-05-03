"use server";

// L.5c — LP chat actions. Used by both the GP-side panel (/lps/[lpId]/chat)
// and the LP-side panel (/lp/messages).

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SendLpMessageResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function sendLpMessage(input: {
  lpId: string;
  body: string;
}): Promise<SendLpMessageResult> {
  const body = input.body.trim();
  if (!body) return { ok: false, error: "Message can't be empty" };
  if (body.length > 4000) return { ok: false, error: "Message must be ≤ 4000 chars" };

  const supabase = createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return { ok: false, error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("users")
    .select("id, organization_id")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();
  if (!profile?.organization_id || !profile.id) {
    return { ok: false, error: "No fund assigned" };
  }

  // Confirm the LP belongs to the same org.
  const { data: lp } = await supabase
    .from("lps")
    .select("id, organization_id")
    .eq("id", input.lpId)
    .maybeSingle();
  if (!lp || lp.organization_id !== profile.organization_id) {
    return { ok: false, error: "LP not in your fund" };
  }

  const { data, error } = await (supabase as any)
    .from("lp_messages")
    .insert({
      organization_id: profile.organization_id,
      lp_id: input.lpId,
      author_user_id: profile.id,
      body,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };

  revalidatePath("/lps");
  revalidatePath(`/lps/${input.lpId}/chat`);
  revalidatePath("/lp/messages");
  return { ok: true, id: data.id };
}

export type MarkReadResult = { ok: true } | { ok: false; error: string };

/** Mark every other-side message in this thread as read by the current viewer. */
export async function markLpThreadRead(input: { lpId: string }): Promise<MarkReadResult> {
  const supabase = createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return { ok: false, error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("users")
    .select("id, role")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();
  if (!profile?.id) return { ok: false, error: "No profile" };

  // Mark messages NOT authored by current user.
  const { error } = await (supabase as any)
    .from("lp_messages")
    .update({ read_by_other_at: new Date().toISOString() })
    .eq("lp_id", input.lpId)
    .neq("author_user_id", profile.id)
    .is("read_by_other_at", null);
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
