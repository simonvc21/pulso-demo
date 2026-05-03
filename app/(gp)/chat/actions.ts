"use server";

import { revalidatePath } from "next/cache";
import {
  listConversations,
  getConversationMessages,
  deleteConversation,
  type ChatConversation,
  type ChatMessage,
} from "@/lib/chat-history";

export async function loadConversations(): Promise<ChatConversation[]> {
  return listConversations(30);
}

export async function loadMessages(conversationId: string): Promise<ChatMessage[]> {
  if (!conversationId) return [];
  return getConversationMessages(conversationId);
}

export async function removeConversation(conversationId: string): Promise<{ ok: boolean }> {
  if (!conversationId) return { ok: false };
  const ok = await deleteConversation(conversationId);
  if (ok) {
    revalidatePath("/dashboard");
    revalidatePath("/lp");
  }
  return { ok };
}
