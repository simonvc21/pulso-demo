"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2, MessageSquarePlus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CompanyUpdate } from "@/lib/dashboard-data";
import { addCompanyUpdate, deleteCompanyUpdate } from "../actions";

interface Props {
  companyId: string;
  initial: CompanyUpdate[];
}

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

export function UpdatesFeed({ companyId, initial }: Props) {
  const [items, setItems] = useState<CompanyUpdate[]>(initial);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const body = draft.trim();
    if (!body) return;
    setError(null);
    startTransition(async () => {
      const res = await addCompanyUpdate({ companyId, body });
      if (!res.ok) { setError(res.error); return; }
      setItems((prev) => [
        {
          id: res.id,
          body,
          createdAt: new Date().toISOString(),
          author: { id: null, name: "You", email: null },
        },
        ...prev,
      ]);
      setDraft("");
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this update?")) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteCompanyUpdate(id);
      if (!res.ok) { setError(res.error); return; }
      setItems((prev) => prev.filter((u) => u.id !== id));
    });
  }

  return (
    <div className="bg-white rounded-xl border border-line shadow-card p-5">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div>
          <h3 className="text-[10px] tracking-[0.16em] uppercase text-muted font-semibold">Team updates</h3>
          <p className="text-[11px] text-muted mt-0.5">
            Internal log: had-call notes, runway extensions, founder convo summaries. Visible to your team only.
          </p>
        </div>
        <span className="text-[11px] text-muted">{items.length} entries</span>
      </div>

      {/* Composer */}
      <div className="bg-paper rounded-lg border border-line p-3 mb-4">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="Spoke with founder about Series A timing — they want to start raising in Q3. Will introduce 3 funds next week."
          className="w-full px-2.5 py-2 rounded-md border border-line text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal/30 resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
          }}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-muted">{draft.length} / 4000 · ⌘↵ to post</span>
          <Button
            variant="gold"
            size="sm"
            className="gap-1.5"
            onClick={submit}
            disabled={pending || !draft.trim()}
          >
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquarePlus className="h-3 w-3" />}
            Post update
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-coral/30 bg-coral/10 text-coral px-3 py-1.5 text-[11px] mb-3 flex items-center gap-1.5">
          <AlertCircle className="h-3 w-3" /> {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-[12px] text-muted italic px-2 py-4 text-center">
          No updates yet. Drop your first team note above — it'll show up here in reverse-chronological order.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((u) => (
            <li key={u.id} className="bg-paper2/40 rounded-lg border border-line p-3 group">
              <div className="flex items-baseline justify-between gap-2 mb-1.5">
                <div className="text-[11px] text-muted">
                  <span className="font-semibold text-ink">{u.author.name ?? u.author.email ?? "Team"}</span>
                  {" · "}
                  <span title={new Date(u.createdAt).toLocaleString()}>{relativeTime(u.createdAt)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => remove(u.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted hover:text-coral transition-opacity"
                  aria-label="Delete update"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <div className="text-[13px] text-ink whitespace-pre-wrap leading-relaxed">{u.body}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
