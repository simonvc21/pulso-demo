"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X, Send, Loader2, Bot, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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
  "Top 3 by ARR growth QoQ",
  "Who hasn't responded to the last form?",
];

export function ChatDock({
  scopeHint = "Ask anything about your portfolio.",
  examples = DEFAULT_EXAMPLES,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setMounted(true), []);

  // Lock body scroll while panel is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, pending]);

  // Autoscroll on new message
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, pending]);

  // Focus input when opening
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

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
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong");
      } else {
        setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
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
          <button
            onClick={() => !pending && setOpen(false)}
            className="text-white/70 hover:text-white p-1.5"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
          {messages.length === 0 && !pending && (
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
