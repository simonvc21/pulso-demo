import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WatchListItem {
  slug: string;
  name: string;
  status: "healthy" | "watch" | "critical" | "no-data";
  flag: string | null;
}

export function WatchList({ items }: { items: WatchListItem[] }) {
  return (
    <div className="bg-navy text-white rounded-xl overflow-hidden h-full flex flex-col">
      <div className="px-5 pt-4 pb-3 border-b border-white/10 flex items-center justify-between">
        <h3 className="text-[10px] font-semibold text-gold tracking-[0.18em] uppercase">Companies needing attention</h3>
        <span className="text-[11px] text-white/60">{items.length} flagged</span>
      </div>
      <div className="flex-1 divide-y divide-white/5">
        {items.length === 0 && (
          <div className="px-5 py-6 text-[12px] text-white/60">
            No companies flagged. Nice.
          </div>
        )}
        {items.map((c) => (
          <Link
            key={c.slug}
            href={`/companies/${c.slug}`}
            className="px-5 py-3 flex items-center gap-3 hover:bg-navy-700 transition-colors group"
          >
            <span className={cn(
              "h-2 w-2 rounded-full shrink-0",
              c.status === "critical" ? "bg-coral" : "bg-gold"
            )} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{c.name}</div>
              <div className="text-[11px] text-white/60 truncate">{c.flag}</div>
            </div>
            <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-white/70 transition-colors shrink-0" />
          </Link>
        ))}
      </div>
      <div className="px-5 py-3 border-t border-white/10">
        <Link href="/companies" className="text-[11px] font-medium text-gold hover:underline">
          View all companies →
        </Link>
      </div>
    </div>
  );
}
