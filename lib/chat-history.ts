// Server-side helpers for L.13 persistent AI chat history.
// Imported by /api/chat (route handler) and the ChatDock data layer.

import { createClient } from "@/lib/supabase/server";

export type ChatScope = "gp" | "lp";
export type ChatRole = "user" | "assistant";

export interface ChatConversation {
  id: string;
  title: string | null;
  scope: ChatScope;
  createdAt: string;
  lastMessageAt: string;
  /** Message count for the list UI; computed via separate aggregate query if needed. */
  messageCount?: number;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

/** Resolve the public.users.id for the currently-authenticated user. Returns
 *  null if the user is not logged in or doesn't have a profile yet. */
export async function getCurrentUserRowId(): Promise<{ userId: string; orgId: string | null } | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("users")
    .select("id, organization_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!data) return null;
  return { userId: data.id, orgId: data.organization_id ?? null };
}

export async function listConversations(limit = 20): Promise<ChatConversation[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("ai_conversations")
    .select("id, title, scope, created_at, last_message_at")
    .order("last_message_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    title: r.title,
    scope: r.scope,
    createdAt: r.created_at,
    lastMessageAt: r.last_message_at,
  }));
}

export async function getConversationMessages(conversationId: string): Promise<ChatMessage[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("ai_messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    role: r.role,
    content: r.content,
    createdAt: r.created_at,
  }));
}

/** Create a new conversation owned by the current user. Returns the new id. */
export async function createConversation(scope: ChatScope): Promise<string | null> {
  const ctx = await getCurrentUserRowId();
  if (!ctx || !ctx.orgId) return null;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({ user_id: ctx.userId, organization_id: ctx.orgId, scope })
    .select("id")
    .single();
  if (error || !data) return null;
  return data.id;
}

export async function appendMessage(
  conversationId: string,
  role: ChatRole,
  content: string,
  tokenCount?: number,
): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("ai_messages")
    .insert({ conversation_id: conversationId, role, content, token_count: tokenCount ?? null })
    .select("id")
    .single();
  if (error || !data) return null;
  return data.id;
}

/** Update the conversation title (used by the auto-titler after the first turn). */
export async function setConversationTitle(conversationId: string, title: string): Promise<void> {
  const supabase = createClient();
  const trimmed = title.trim().slice(0, 200);
  if (!trimmed) return;
  await supabase
    .from("ai_conversations")
    .update({ title: trimmed })
    .eq("id", conversationId);
}

export async function deleteConversation(conversationId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("ai_conversations")
    .delete()
    .eq("id", conversationId);
  return !error;
}
