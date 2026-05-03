"use client";

// L.5c — Shared chat panel rendered on both the GP-side LP detail page and
// the LP-side messages page. Optimistically appends new messages so the UX
// feels instant; relies on revalidatePath for cross-tab consistency.

import { useState, useTransition, useEffect, useRef } from "react";
import { Send, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sendLpMessage } from "@/app/(gp)/lps/chat-actions";
import type { LpChatMessage } from "@/lib/lp-chat";

interface Props {
  lpId: string;
  lpName: string;
  fundName: string;
  initial: LpChatMessage[];
  /** Visual side: who is viewing — affects bubble alignment + labels. */
  viewerRole: "lp" | "gp";
  /** Current user id so optimistic messages render with isCurrentUser. */
  currentUserId: string | null;
  currentUserName: string | null;
}

export function LpChatPanel({
  lpId, lpName, fundName, initial, viewerRole, currentUserId, currentUserName,
}: Props) {
  const [messages, setMessages] = useState<LpChatMessage[]>(initial);
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  function send() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setError(null);
    const optimistic: LpChatMessage = {
      id: `tmp-${Date.now()}`,
      lpId,
      body: trimmed,
      createdAt: new Date().toISOString(),
      authorRole: viewerRole,
      authorName: currentUserName,
      authorEmail: null,
      isCurrentUser: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setBody("");
    startTransition(async () => {
      const res = await sendLpMessage({ lpId, body: trimmed });
      if (!res.ok) {
        setError(res.error);
        // Roll back the optimistic message on failure.
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      }
    });
  }

  const otherSideLabel = viewerRole === "lp" ? fundName : lpName;

  return (
    <div className="bg-white rounded-xl border border-line shadow-card overflow-hidden flex flex-col h-[60vh] min-h-[420px]">
      <header className="px-5 py-3 border-b border-line">
        <h3 className="text-sm font-semibold text-ink">
          {viewerRole === "lp" ? `Message ${fundName}` : `Conversation with ${lpName}`}
        </h3>
        <p className="text-[11px] text-muted mt-0.5">
          Private 1-on-1 thread. {viewerRole === "lp"
            ? "Your GP sees these messages."
            : "Only this LP and the fund team see this thread."}
        </p>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-paper2/30">
        {messages.length === 0 ? (
          <div className="text-center text-[12px] text-muted py-8">
            No messages yet. {viewerRole === "lp"
              ? `Say hi to ${fundName} to start the conversation.`
              : `Send the first message to ${lpName}.`}
          </div>
        ) : (
          messages.map((m) => (
            <Bubble key={m.id} msg={m} viewerRole={viewerRole} otherSideLabel={otherSideLabel} />
          ))
        )}
      </div>

      {error && (
        <div className="border-t border-line bg-coral/10 text-coral px-5 py-2 text-[11px] flex items-center gap-1.5">
          <AlertCircle className="h-3 w-3" /> {error}
        </div>
      )}

      <div className="border-t border-line px-3 py-3 flex items-end gap-2 bg-white">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
          }}
          rows={2}
          placeholder={viewerRole === "lp" ? `Message ${fundName}…` : `Reply to ${lpName}…`}
          maxLength={4000}
          className="flex-1 resize-none px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
        />
        <Button
          variant="gold"
          size="sm"
          className="gap-1.5 shrink-0"
          onClick={send}
          disabled={pending || !body.trim()}
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Send
        </Button>
      </div>
    </div>
  );
}

function Bubble({
  msg, viewerRole, otherSideLabel,
}: { msg: LpChatMessage; viewerRole: "lp" | "gp"; otherSideLabel: string }) {
  const mine = msg.isCurrentUser;
  const fromOtherSide = (viewerRole === "lp" && msg.authorRole === "gp")
    || (viewerRole === "gp" && msg.authorRole === "lp");

  const dt = new Date(msg.createdAt);
  const time = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const date = dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className={cn("flex flex-col gap-0.5", mine ? "items-end" : "items-start")}>
      <div className="text-[10px] text-muted px-1">
        {mine
          ? "You"
          : msg.authorName ?? (fromOtherSide ? otherSideLabel : "Team")}
        <span className="ml-1.5">{date} · {time}</span>
      </div>
      <div className={cn(
        "max-w-[78%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words",
        mine
          ? "bg-navy text-white rounded-br-sm"
          : fromOtherSide
            ? "bg-white border border-line text-ink rounded-bl-sm"
            : "bg-paper2 text-ink rounded-bl-sm",
      )}>
        {msg.body}
      </div>
    </div>
  );
}
