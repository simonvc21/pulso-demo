"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

const STORAGE_KEY = "pulso_ai_banner_dismissed_at";
// Show again after 24h so the user doesn't lose the highlight forever.
const RESHOW_AFTER_MS = 24 * 60 * 60 * 1000;

interface Props {
  qoqGrowth: number;
  flaggedCount: number;
  label: string;
}

export function DashboardAIBanner({ qoqGrowth, flaggedCount, label }: Props) {
  const [open, setOpen] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stamp = localStorage.getItem(STORAGE_KEY);
    if (stamp) {
      const dismissedAt = parseInt(stamp, 10);
      if (Number.isFinite(dismissedAt) && Date.now() - dismissedAt < RESHOW_AFTER_MS) {
        setOpen(false);
      }
    }
    setHydrated(true);
  }, []);

  // SSR safety: render the banner during SSR, then let the client hide it
  // after mount if it was dismissed recently. Avoids a layout flash.
  if (!hydrated) return <BannerShell qoqGrowth={qoqGrowth} flaggedCount={flaggedCount} label={label} onDismiss={() => {}} />;
  if (!open) return null;

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setOpen(false);
  };

  return <BannerShell qoqGrowth={qoqGrowth} flaggedCount={flaggedCount} label={label} onDismiss={handleDismiss} />;
}

function BannerShell({
  qoqGrowth, flaggedCount, label, onDismiss,
}: { qoqGrowth: number; flaggedCount: number; label: string; onDismiss: () => void }) {
  return (
    <div className="bg-gradient-to-r from-navy to-navy-700 rounded-xl p-4 flex items-start gap-3 text-white">
      <div className="h-8 w-8 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
        <Sparkles className="h-4 w-4 text-gold" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-gold font-semibold tracking-[0.16em] uppercase">{label}</div>
        <div className="text-sm mt-1 leading-relaxed">
          Portfolio ARR grew{" "}
          <span className="font-semibold text-teal">
            {qoqGrowth >= 0 ? "+" : ""}{qoqGrowth.toFixed(1)}% MoM
          </span>
          , driven by Vextra and Lumen.{" "}
          <span className="text-gold">{flaggedCount} companies</span> need attention — Brio is the most pressing.
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="text-[11px] text-white/70 hover:text-white transition-colors"
      >
        Dismiss
      </button>
    </div>
  );
}
