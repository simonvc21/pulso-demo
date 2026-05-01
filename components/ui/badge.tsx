import { cn } from "@/lib/utils";
import type { Status } from "@/lib/types";

const statusStyles: Record<Status, { dot: string; bg: string; text: string; label: string }> = {
  healthy:  { dot: "bg-teal",   bg: "bg-teal-50",        text: "text-teal-600", label: "Healthy" },
  watch:    { dot: "bg-gold",   bg: "bg-gold-50",        text: "text-gold-600", label: "Watch" },
  critical: { dot: "bg-coral",  bg: "bg-red-50",         text: "text-coral",    label: "Critical" },
  "no-data":{ dot: "bg-muted",  bg: "bg-paper2",         text: "text-muted",    label: "No data" },
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const s = statusStyles[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium", s.bg, s.text, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

export function Badge({ children, className, tone = "default" }: { children: React.ReactNode; className?: string; tone?: "default" | "navy" | "gold" | "teal" }) {
  const tones = {
    default: "bg-paper2 text-ink",
    navy: "bg-navy text-white",
    gold: "bg-gold text-navy",
    teal: "bg-teal-50 text-teal-600",
  } as const;
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}
