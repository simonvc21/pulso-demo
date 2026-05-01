"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell, CheckCircle2, FileText, Mail, AlertTriangle, Sparkles, TrendingDown,
  Flame, UserPlus, Eye, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/lib/dashboard-data";
import { markNotificationRead, markAllNotificationsRead } from "@/app/(gp)/notifications/actions";

interface Props {
  initialItems: NotificationItem[];
  initialUnread: number;
}

const KIND_META: Record<string, { icon: any; tone: string }> = {
  form_submitted:        { icon: CheckCircle2,   tone: "text-teal-600 bg-teal-50" },
  form_sent:             { icon: Mail,           tone: "text-navy bg-paper2" },
  reminder_sent:         { icon: Mail,           tone: "text-gold-600 bg-gold-50" },
  lp_viewed_letter:      { icon: Eye,            tone: "text-teal-600 bg-teal-50" },
  member_joined:         { icon: UserPlus,       tone: "text-teal-600 bg-teal-50" },
  letter_published:      { icon: Sparkles,       tone: "text-gold-600 bg-gold-50" },
  metric_alert_runway:   { icon: AlertTriangle,  tone: "text-coral bg-red-50" },
  metric_alert_arr_drop: { icon: TrendingDown,   tone: "text-coral bg-red-50" },
  metric_alert_burn_spike: { icon: Flame,        tone: "text-gold-600 bg-gold-50" },
  ai_insight:            { icon: Sparkles,       tone: "text-gold-600 bg-gold-50" },
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
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NotificationBell({ initialItems, initialUnread }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const handleClick = (n: NotificationItem) => {
    if (!n.readAt) {
      startTransition(async () => {
        await markNotificationRead(n.id);
        router.refresh();
      });
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  const handleMarkAll = () => {
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative h-9 w-9 rounded-lg border border-line bg-white hover:bg-paper2 inline-flex items-center justify-center transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4 text-ink" />
        {initialUnread > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-coral text-white text-[10px] font-semibold inline-flex items-center justify-center">
            {initialUnread > 9 ? "9+" : initialUnread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] bg-white rounded-xl border border-line shadow-cardHover overflow-hidden z-40">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-ink">Notifications</div>
              <div className="text-[11px] text-muted">
                {initialUnread === 0 ? "All caught up" : `${initialUnread} unread`}
              </div>
            </div>
            {initialUnread > 0 && (
              <button
                onClick={handleMarkAll}
                disabled={pending}
                className="text-[11px] text-teal-600 hover:underline inline-flex items-center gap-1"
              >
                <Check className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto divide-y divide-line">
            {initialItems.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="h-10 w-10 rounded-full bg-paper2 flex items-center justify-center mx-auto">
                  <Bell className="h-5 w-5 text-muted" />
                </div>
                <div className="mt-3 text-sm text-ink">Nothing here yet</div>
                <div className="text-[11px] text-muted mt-1">
                  You'll see form submissions, LP views, and metric alerts.
                </div>
              </div>
            ) : (
              initialItems.map((n) => {
                const meta = KIND_META[n.kind] ?? { icon: FileText, tone: "text-muted bg-paper2" };
                const Icon = meta.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={cn(
                      "w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-paper transition-colors",
                      !n.readAt && "bg-teal-50/30"
                    )}
                  >
                    <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0", meta.tone)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className={cn("text-[13px] leading-snug", !n.readAt ? "text-ink font-medium" : "text-ink")}>
                          {n.title}
                        </div>
                        {!n.readAt && <span className="h-2 w-2 rounded-full bg-teal shrink-0 mt-1.5" />}
                      </div>
                      {n.body && <div className="text-[11px] text-muted mt-0.5 truncate">{n.body}</div>}
                      <div className="text-[10px] text-muted mt-1">{relativeTime(n.createdAt)}</div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="px-4 py-2 border-t border-line">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block text-[12px] text-center text-navy hover:underline font-medium"
            >
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
