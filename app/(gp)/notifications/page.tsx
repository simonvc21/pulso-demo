import Link from "next/link";
import {
  Bell, CheckCircle2, FileText, Mail, AlertTriangle, Sparkles, TrendingDown,
  Flame, UserPlus, Eye, Check,
} from "lucide-react";
import { Topbar } from "@/components/topbar";
import { TopbarBell } from "@/components/topbar-bell";
import { Button } from "@/components/ui/button";
import { getNotifications } from "@/lib/dashboard-data";
import { markAllNotificationsRead } from "./actions";
import { cn } from "@/lib/utils";
import { ts } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

const KIND_META: Record<string, { icon: any; tone: string; label: string }> = {
  form_submitted:        { icon: CheckCircle2,  tone: "text-teal-600 bg-teal-50",   label: "Form submitted" },
  form_sent:             { icon: Mail,          tone: "text-navy bg-paper2",        label: "Form sent" },
  reminder_sent:         { icon: Mail,          tone: "text-gold-600 bg-gold-50",   label: "Reminder sent" },
  lp_viewed_letter:      { icon: Eye,           tone: "text-teal-600 bg-teal-50",   label: "LP viewed letter" },
  member_joined:         { icon: UserPlus,      tone: "text-teal-600 bg-teal-50",   label: "Member joined" },
  letter_published:      { icon: Sparkles,      tone: "text-gold-600 bg-gold-50",   label: "Letter published" },
  metric_alert_runway:   { icon: AlertTriangle, tone: "text-coral bg-red-50",       label: "Runway alert" },
  metric_alert_arr_drop: { icon: TrendingDown,  tone: "text-coral bg-red-50",       label: "ARR alert" },
  metric_alert_burn_spike: { icon: Flame,       tone: "text-gold-600 bg-gold-50",   label: "Burn alert" },
  ai_insight:            { icon: Sparkles,      tone: "text-gold-600 bg-gold-50",   label: "AI insight" },
  lp_commented:          { icon: Mail,          tone: "text-gold-600 bg-gold-50",   label: "LP commented" },
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

export default async function NotificationsPage() {
  const items = await getNotifications(100);
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <>
      <Topbar
        bell={<TopbarBell />}
        title={ts("notifications.title")}
        breadcrumb={ts("notifications.breadcrumb", { total: items.length, unread })}
        actions={
          unread > 0 ? (
            <form action={async () => { "use server"; await markAllNotificationsRead(); }}>
              <Button type="submit" variant="outline" size="sm" className="gap-1.5">
                <Check className="h-3.5 w-3.5" /> {ts("notifications.mark_all_read")}
              </Button>
            </form>
          ) : null
        }
      />
      <div className="px-8 py-6 max-w-3xl">
        {items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-line shadow-card p-12 text-center">
            <div className="h-12 w-12 rounded-full bg-paper2 flex items-center justify-center mx-auto">
              <Bell className="h-6 w-6 text-muted" />
            </div>
            <div className="mt-4 text-base font-serif font-semibold text-ink">No notifications yet</div>
            <p className="mt-2 text-[13px] text-muted max-w-md mx-auto">
              You'll see form submissions from founders, LP letter views, member changes, and metric alerts here.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-line shadow-card divide-y divide-line overflow-hidden">
            {items.map((n) => {
              const meta = KIND_META[n.kind] ?? { icon: FileText, tone: "text-muted bg-paper2", label: n.kind };
              const Icon = meta.icon;
              const inner = (
                <div className={cn(
                  "px-5 py-3 flex items-start gap-3 transition-colors",
                  !n.readAt ? "bg-teal-50/30 hover:bg-teal-50/60" : "hover:bg-paper"
                )}>
                  <div className={cn("h-9 w-9 rounded-full flex items-center justify-center shrink-0", meta.tone)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className={cn("text-sm leading-snug", !n.readAt ? "text-ink font-medium" : "text-ink")}>
                        {n.title}
                      </div>
                      {!n.readAt && <span className="h-2 w-2 rounded-full bg-teal shrink-0 mt-1.5" />}
                    </div>
                    {n.body && <div className="text-[12px] text-muted mt-0.5">{n.body}</div>}
                    <div className="text-[10px] text-muted mt-1.5 inline-flex items-center gap-2">
                      <span>{meta.label}</span>
                      <span>·</span>
                      <span>{relativeTime(n.createdAt)}</span>
                    </div>
                  </div>
                </div>
              );
              return n.link ? (
                <Link key={n.id} href={n.link} className="block">{inner}</Link>
              ) : (
                <div key={n.id}>{inner}</div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
