"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

const COOKIE = "pulso_locale";

function readCookie(): "en" | "es" {
  if (typeof document === "undefined") return "en";
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`));
  return m && m[1] === "es" ? "es" : "en";
}

function writeCookie(v: "en" | "es") {
  // 1 year, root path, all subroutes
  document.cookie = `${COOKIE}=${v}; max-age=${60 * 60 * 24 * 365}; path=/; samesite=lax`;
}

export function LocaleSwitcher() {
  const router = useRouter();
  const [locale, setLocale] = useState<"en" | "es">("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setLocale(readCookie());
  }, []);

  if (!mounted) {
    return <div className="h-7 w-16 rounded-md bg-white/5 border border-white/10" />;
  }

  const set = (v: "en" | "es") => {
    if (v === locale) return;
    setLocale(v);
    writeCookie(v);
    router.refresh();
  };

  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-white/5 border border-white/10" title="Language">
      {(["en", "es"] as const).map((l) => {
        const active = locale === l;
        return (
          <button
            key={l}
            type="button"
            onClick={() => set(l)}
            className={cn(
              "h-7 w-7 rounded-md text-[11px] font-semibold tracking-wide transition-colors uppercase",
              active ? "bg-gold text-navy" : "text-white/60 hover:text-white hover:bg-white/10"
            )}
            aria-label={l === "en" ? "English" : "Español"}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}
