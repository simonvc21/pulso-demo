"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2, MessageCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  postCompanyComment,
  deleteCompanyComment,
  toggleCompanyReaction,
} from "@/app/(gp)/companies/[slug]/engagement-actions";
// Types-only import works (no runtime import). REACTION_LABELS is plain
// data so we re-declare it inline to avoid pulling the server-only loader
// module into the client bundle.
import type { CompanyComment, ReactionSummary, ReactionKind } from "@/lib/lp-engagement";

const REACTION_LABELS: Record<ReactionKind, { emoji: string; label: string }> = {
  clap:       { emoji: "👏", label: "Nicely done" },
  rocket:     { emoji: "🚀", label: "Huge milestone" },
  concerned:  { emoji: "😬", label: "Worried" },
  thinking:   { emoji: "🤔", label: "Need more info" },
};

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface ReactionsBarProps {
  companyId: string;
  initial: ReactionSummary[];
}

export function ReactionsBar({ companyId, initial }: ReactionsBarProps) {
  const [reactions, setReactions] = useState<ReactionSummary[]>(initial);
  const [pendingKind, setPendingKind] = useState<ReactionKind | null>(null);
  const [, startTransition] = useTransition();

  const toggle = (kind: ReactionKind) => {
    setPendingKind(kind);
    // Optimistic update
    setReactions((prev) =>
      prev.map((r) =>
        r.kind === kind
          ? { ...r, mine: !r.mine, count: r.count + (r.mine ? -1 : 1) }
          : r
      )
    );
    startTransition(async () => {
      const res = await toggleCompanyReaction({ companyId, kind });
      setPendingKind(null);
      if (!res.ok) {
        // Revert optimistic on failure
        setReactions((prev) =>
          prev.map((r) =>
            r.kind === kind
              ? { ...r, mine: !r.mine, count: r.count + (r.mine ? -1 : 1) }
              : r
          )
        );
      }
    });
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {reactions.map((r) => {
        const meta = REACTION_LABELS[r.kind];
        const isPending = pendingKind === r.kind;
        return (
          <button
            key={r.kind}
            type="button"
            onClick={() => toggle(r.kind)}
            disabled={isPending}
            title={meta.label}
            className={cn(
              "inline-flex items-center gap-1.5 h-7 px-2 rounded-full border text-[12px] transition-colors",
              r.mine
                ? "bg-gold/15 border-gold/40 text-gold-600 font-medium"
                : "bg-paper2 border-line text-muted hover:border-gold/30 hover:text-ink",
              r.count === 0 && !r.mine && "opacity-70"
            )}
          >
            <span className="text-sm leading-none">{meta.emoji}</span>
            {isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              r.count > 0 && <span className="tabular-nums">{r.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface CommentsThreadProps {
  companyId: string;
  initial: CompanyComment[];
  /** Whether the current user can mutate (delete) any comment (GP/MP/partner). */
  canModerate: boolean;
  /** Current user's public.users.id — used to know which trash buttons to show. */
  currentUserId: string | null;
  /** Render a tighter variant for the LP page. */
  compact?: boolean;
}

export function CommentsThread({
  companyId,
  initial,
  canModerate,
  currentUserId,
  compact = false,
}: CommentsThreadProps) {
  const [items, setItems] = useState<CompanyComment[]>(initial);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const body = draft.trim();
    if (!body) return;
    setError(null);
    startTransition(async () => {
      const res = await postCompanyComment({ companyId, body });
      if (!res.ok) { setError(res.error); return; }
      // We don't have author info from the server response, so refresh
      // optimistically with what we know.
      setItems((prev) => [
        {
          id: res.id ?? `tmp-${Date.now()}`,
          body,
          createdAt: new Date().toISOString(),
          hidden: false,
          author: {
            id: currentUserId ?? "self",
            name: "You",
            email: null,
            role: null,
            isLp: false,
          },
        },
        ...prev,
      ]);
      setDraft("");
    });
  };

  const remove = (id: string) => {
    if (!confirm("Delete this comment?")) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteCompanyComment(id);
      if (!res.ok) { setError(res.error); return; }
      setItems((prev) => prev.filter((c) => c.id !== id));
    });
  };

  return (
    <div className={cn("bg-white rounded-xl border border-line shadow-card p-5", compact && "p-4")}>
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h3 className="text-[10px] tracking-[0.16em] uppercase text-muted font-semibold inline-flex items-center gap-1.5">
            <MessageCircle className="h-3 w-3" /> Discussion
          </h3>
          <p className="text-[11px] text-muted mt-0.5">
            Visible to your fund (GPs + LPs).
          </p>
        </div>
        <span className="text-[11px] text-muted">{items.length} comment{items.length === 1 ? "" : "s"}</span>
      </div>

      {/* Composer */}
      <div className="bg-paper rounded-lg border border-line p-3 mb-4">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Quick question, observation, or kudos for the team…"
          className="w-full px-2.5 py-2 rounded-md border border-line text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal/30 resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
          }}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-muted">{draft.length} / 2000 · ⌘↵ to post</span>
          <Button
            variant="gold"
            size="sm"
            className="gap-1.5"
            onClick={submit}
            disabled={pending || !draft.trim()}
          >
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageCircle className="h-3 w-3" />}
            Post
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-coral/30 bg-coral/10 text-coral px-3 py-1.5 text-[11px] mb-3 inline-flex items-center gap-1.5">
          <AlertCircle className="h-3 w-3" /> {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-[12px] text-muted italic px-2 py-4 text-center">
          No comments yet. Be the first.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((c) => {
            const canDelete = canModerate || (currentUserId && c.author.id === currentUserId);
            const authorName = c.author.name || c.author.email || "Someone";
            return (
              <li key={c.id} className="bg-paper2/40 rounded-lg border border-line p-3 group">
                <div className="flex items-baseline justify-between gap-2 mb-1.5">
                  <div className="text-[11px] text-muted">
                    <span className="font-semibold text-ink">{authorName}</span>
                    {c.author.isLp && (
                      <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-gold/15 text-gold-600">
                        LP
                      </span>
                    )}
                    {" · "}
                    <span title={new Date(c.createdAt).toLocaleString()}>{relativeTime(c.createdAt)}</span>
                  </div>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted hover:text-coral transition-opacity"
                      aria-label="Delete comment"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="text-[13px] text-ink whitespace-pre-wrap leading-relaxed">{c.body}</div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
