"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Avoid hydration mismatch — render a placeholder until mounted.
  if (!mounted) {
    return (
      <div
        className={cn(
          "rounded-lg border border-white/10 bg-white/5",
          compact ? "h-8 w-24" : "h-9 w-full"
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
