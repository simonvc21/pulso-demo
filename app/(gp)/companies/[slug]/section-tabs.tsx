"use client";

// L.4b — Tabbed section switcher for the company detail page.
// Keeps URL clean (state in component, not query) so tab choice doesn't
// re-render the whole server tree.

import { useState } from "react";
import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
  count?: number;
  content: React.ReactNode;
}

export function SectionTabs({ tabs, defaultTab }: { tabs: Tab[]; defaultTab?: string }) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id ?? "");
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 border-b border-line">
        {tabs.map((t) => {
          const on = t.id === current?.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className={cn(
                "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                on
                  ? "border-teal-600 text-ink"
                  : "border-transparent text-muted hover:text-ink",
              )}
            >
              {t.label}
              {typeof t.count === "number" && t.count > 0 && (
                <span className={cn(
                  "ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums",
                  on ? "bg-teal-50 text-teal-600" : "bg-paper2 text-muted",
                )}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div>{current?.content}</div>
    </div>
  );
}
