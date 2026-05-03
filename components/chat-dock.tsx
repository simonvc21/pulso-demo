"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X, Send, Loader2, Bot, User as UserIcon, History, Plus, Trash2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadConversations, loadMessages, removeConversation } from "@/app/(gp)/chat/actions";
import type { ChatConversation, ChatMessage } from "@/lib/chat-history";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  /** Hint shown in the empty state. */
  scopeHint?: string;
  /** Suggested first prompts the user can click to seed the conversation. */
  examples?: string[];
}

const DEFAULT_EXAMPLES = [
  "Which company has the worst runway right now?",
  "What's the biggest news this quarter?",
  "Top 3 by ARR growth MoM",
  "Who hasn't responded to the last form?",
];

function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ChatDock({
  scopeHint = "Ask anything about your portfolio.",
  examples = DEFAULT_EXAMPLES,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, pending]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, pending]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Lazy-load conversation list the first time the panel opens.
  useEffect(() => {
    if (!open || conversationsLoaded) return;
    loadConversations().then((list) => {
      setConversations(list);
      setConversationsLoaded(true);
    }).catch(() => setConversationsLoaded(true));
  }, [open, conversationsLoaded]);

  const refreshConversations = async () => {
    try {
      const list = await loadConversations();
      setConversations(list);
    } catch {}
  };

  const startNewChat = () => {
    setMessages([]);
    setConversationId(null);
    setError(null);
    setShowHistory(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const openConversation = async (id: string) => {
    setLoadingHistory(true);
    setError(null);
    try {
      const msgs = await loadMessages(id);
      setMessages(msgs.map((m: ChatMessage) => ({ role: m.role, content: m.content })));
      setConversationId(id);
      setShowHistory(false);
    } catch (e: any) {
      setError(e?.message ?? "Could not load conversation");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this conversation? This can't be undone.")) return;
    const res = await removeConversation(id);
    if (res.ok) {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (conversationId === id) startNewChat();
    }
  };

  const send = async (text: string) => {
    const clean = text.trim();
    if (!clean || pending) return;
    setError(null);
    setInput("");
    const next: Message[] = [...messages, { role: "user", content: clean }];
    setMessages(next);
    setPending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, conversationId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong");
      } else {
        setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
        if (data.conversationId && data.conversationId !== conversationId) {
          setConversationId(data.conversationId);
        }
        // Refresh the sidebar so the latest conversation jumps to the top
        // (and gets its auto-generated title after the first turn).
        if (data.titledNow || !conversationId) {
          refreshConversations();
        }
      }
    } catch (e: any) {
      setError(e?.message ?? "Network error");
    } finally {
      setPending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const button = (
    <button
      onClick={() => setOpen(true)}
      className="no-print fixed bottom-5 right-5 z-[90] h-12 w-12 rounded-full bg-navy text-gold shadow-cardHover hover:bg-navy-700 transition-colors inline-flex items-center justify-center"
      aria-label="Open Pulso AI"
      title="Ask Pulso AI"
    >
      <Sparkles className="h-5 w-5" fill="currentColor" />
    </button>
  );

  const panel = open ? (
    <div
      className="fixed inset-0 z-[1000] bg-navy/30"
      onClick={() => !pending && setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fixed top-0 right-0 h-screen w-full sm:w-[420px] bg-paper shadow-cardHover flex flex-col animate-fade-in"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-line bg-navy text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gold text-navy flex items-center justify-center">
              <Sparkles className="h-4 w-4" fill="currentColor" />
            </div>
            <div className="leading-tight">
              <div className="text-[10px] tracking-[0.18em] text-gold font-semibold uppercase">Pulso AI</div>
              <div className="text-[11px] text-white/70">Powered by Gemini · context-aware</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                showHistory ? "bg-white/10 text-gold" : "text-white/70 hover:text-white"
              )}
              aria-label="Toggle conversation history"
              title="Conversation history"
            >
              <History className="h-4 w-4" />
            </button>
            <button
              onClick={startNewChat}
              className="p-1.5 rounded-md text-white/70 hover:text-white"
              aria-label="New chat"
              title="New chat"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              onClick={() => !pending && setOpen(false)}
              className="text-white/70 hover:text-white p-1.5"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* History panel — slides over the message area when toggled */}
        {showHistory && (
          <div className="absolute top-[57px] left-0 right-0 bottom-0 bg-paper z-10 flex flex-col animate-fade-in">
            <div className="px-4 py-3 border-b border-line flex items-center justify-between">
              <div className="text-[11px] font-semibold text-ink tracking-[0.14em] uppercase">
                Recent conversations
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="text-muted hover:text-ink p-1"
                aria-label="Close history"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {!conversationsLoaded && (
                <div className="px-3 py-6 text-center text-[12px] text-muted inline-flex items-center justify-center gap-2 w-full">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                </div>
              )}
              {conversationsLoaded && conversations.length === 0 && (
                <div className="px-3 py-8 text-center text-[12px] text-muted">
                  No saved conversations yet. Ask Pulso AI anything to start one.
                </div>
              )}
              {conversations.map((c) => {
                const isCurrent = c.id === conversationId;
                return (
                  <button
                    key={c.id}
                    onClick={() => openConversation(c.id)}
                    className={cn(
                      "group w-full text-left px-3 py-2.5 rounded-lg flex items-start gap-2 transition-colors",
                      isCurrent ? "bg-teal-50 border border-teal/30" : "hover:bg-paper2 border border-transparent"
                    )}
                  >
                    <MessageSquare className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", isCurrent ? "text-teal-600" : "text-muted")} />
                    <div className="flex-1 min-w-0">
                      <div className={cn("text-[12px] font-medium truncate", isCurrent ? "text-ink" : "text-ink")}>
                        {c.title || "Untitled chat"}
                      </div>
                      <div className="text-[10px] text-muted mt-0.5">
                        {formatRelativeTime(c.lastMessageAt)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDelete(c.id, e)}
                      className="opacity-0 group-hover:opacity-100 text-muted hover:text-coral transition-opacity p-1"
                      aria-label="Delete conversation"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-line p-3">
              <button
                onClick={startNewChat}
                className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-navy text-white text-[12px] font-medium hover:bg-navy-700 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> New chat
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
          {loadingHistory && (
            <div className="text-[12px] text-muted inline-flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading conversation…
            </div>
          )}

          {!loadingHistory && messages.length === 0 && !pending && (
            <div>
              <div className="text-[12px] text-muted">{scopeHint}</div>
              <div className="mt-4 space-y-2">
                {examples.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => send(ex)}
                    className="w-full text-left text-[13px] text-ink bg-white border border-line rounded-xl px-3.5 py-2.5 hover:border-teal hover:bg-teal-50 transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={cn("flex gap-2", m.role === "user" ? "flex-row-reverse" : "")}>
              <div className={cn(
                "h-7 w-7 rounded-full flex items-center justify-center shrink-0",
                m.role === "user" ? "bg-paper2 text-navy" : "bg-navy text-gold"
              )}>
                {m.role === "user" ? <UserIcon className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" fill="currentColor" />}
              </div>
              <div className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap",
                m.role === "user"
                  ? "bg-navy text-white rounded-br-sm"
                  : "bg-white border border-line text-ink rounded-bl-sm"
              )}>
                {m.content}
              </div>
            </div>
          ))}

          {pending && (
            <div className="flex gap-2">
              <div className="h-7 w-7 rounded-full bg-navy text-gold flex items-center justify-center shrink-0">
                <Bot className="h-3.5 w-3.5" fill="currentColor" />
              </div>
              <div className="bg-white border border-line rounded-2xl rounded-bl-sm px-3.5 py-2.5 inline-flex items-center gap-2 text-[12px] text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pulso is thinking…
              </div>
            </div>
          )}

          {error && (
            <div className="text-[12px] text-coral bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-line bg-white px-3 py-3 shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Ask Pulso AI…"
              disabled={pending}
              className="flex-1 max-h-32 resize-none rounded-xl border border-line bg-white px-3 py-2.5 text-[13px] text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-teal/30"
              style={{ minHeight: 38 }}
            />
            <button
              onClick={() => send(input)}
              disabled={pending || !input.trim()}
              className="h-9 w-9 rounded-lg bg-gold text-navy hover:bg-gold-600 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center transition-colors"
              aria-label="Send"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <div className="text-[10px] text-muted mt-1.5 px-1">
            Enter to send · Shift+Enter for newline · ESC to close
          </div>
        </div>
      </div>
    </div>
  ) : null;

  if (!mounted) return null;

  return (
    <>
      {createPortal(button, document.body)}
      {panel && createPortal(panel, document.body)}
    </>
  );
}
