import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  delta?: { text: string; trend: "up" | "down" | "flat" };
  hint?: string;
}

export function KpiCard({ label, value, delta, hint }: KpiCardProps) {
  const trendStyle = delta
    ? delta.trend === "up"
      ? { color: "text-teal-600", Icon: ArrowUp }
      : delta.trend === "down"
      ? { color: "text-coral", Icon: ArrowDown }
      : { color: "text-muted", Icon: Minus }
    : null;

  return (
    <div className="bg-white rounded-xl border border-line p-4 shadow-card hover:shadow-cardHover transition-shadow">
      <div className="text-[10px] font-semibold text-muted tracking-[0.14em] uppercase">{label}</div>
      <div className="mt-1.5 font-serif text-[28px] font-bold text-ink leading-none tracking-tight">{value}</div>
      <div className="mt-2 flex items-center gap-2 min-h-[18px]">
        {delta && trendStyle && (
          <span className={cn("inline-flex items-center gap-1 text-xs font-medium", trendStyle.color)}>
            <trendStyle.Icon className="h-3 w-3" />
            {delta.text}
          </span>
        )}
        {hint && <span className="text-[11px] text-muted">{hint}</span>}
      </div>
    </div>
  );
}
