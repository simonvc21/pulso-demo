"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  compact?: boolean;
  /** When true, renders as a single button that cycles through themes
   *  (used by the collapsed sidebar where horizontal space is tight). */
  cycle?: boolean;
}

export function ThemeToggle({ compact = false, cycle = false }: Props) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Avoid hydration mismatch — render a placeholder until mounted.
  if (!mounted) {
    return (
      <div
        className={cn(
          "rounded-lg border border-white/10 bg-white/5",
          cycle ? "h-7 w-7" : compact ? "h-8 w-24" : "h-9 w-full"
        )}
      />
    );
  }

  const options: { value: "light" | "dark" | "system"; icon: any; label: string }[] = [
    { value: "light",  icon: Sun,     label: "Light" },
    { value: "dark",   icon: Moon,    label: "Dark" },
    { value: "system", icon: Monitor, label: "System" },
  ];

  const current = (theme as "light" | "dark" | "system" | undefined) ?? "system";

  if (cycle) {
    const idx = options.findIndex((o) => o.value === current);
    const cur = options[idx >= 0 ? idx : 2];
    const next = options[(idx + 1) % options.length];
    const Icon = cur.icon;
    return (
      <button
        type="button"
        onClick={() => setTheme(next.value)}
        title={`Theme: ${cur.label} (click for ${next.label})`}
        aria-label={`Theme: ${cur.label} (click to cycle)`}
        className="h-7 w-7 rounded-md flex items-center justify-center bg-white/5 border border-white/10 text-white/70 hover:text-gold hover:border-gold/40 transition-colors"
      >
        <Icon className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-white/5 border border-white/10">
      {options.map((o) => {
        const Icon = o.icon;
        const active = current === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => setTheme(o.value)}
            title={o.label}
            aria-label={o.label}
            className={cn(
              "h-7 w-7 rounded-md flex items-center justify-center transition-colors",
              active
                ? "bg-gold text-navy"
                : "text-white/60 hover:text-white hover:bg-white/10"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
