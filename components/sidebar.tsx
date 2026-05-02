"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, FileText, Users, Settings, Zap, Share2, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  fundName: string;
  vintage: number | null;
  sizeUsd: number;
  logoUrl?: string | null;
}

const nav = [
  { href: "/dashboard", label: "Overview",   icon: LayoutDashboard },
  { href: "/companies", label: "Companies",  icon: Building2 },
  { href: "/forms",     label: "Forms",      icon: FileText },
  { href: "/lps",       label: "LPs",        icon: Users },
];

const secondary = [
  { href: "/share/q1-2026-lp-letter?preview=1", label: "LP view (preview)",     icon: Share2 },
  { href: "/fill/q1-2026-financials?preview=1", label: "Founder fill (preview)", icon: Send },
  { href: "/settings",                          label: "Settings",                icon: Settings },
];

export function Sidebar({ fundName, vintage, sizeUsd, logoUrl }: SidebarProps) {
  const path = usePathname() || "";
  const sizeM = sizeUsd > 0 ? `$${(sizeUsd / 1_000_000).toFixed(0)}M` : "—";
  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-navy text-white h-screen sticky top-0">
      {/* Brand */}
      <div className="px-5 pt-6 pb-5 flex items-center gap-2.5">
        {logoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={logoUrl}
            alt={fundName}
            className="h-8 w-8 rounded-md object-contain bg-white p-0.5"
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-gold flex items-center justify-center">
            <Zap className="h-4 w-4 text-navy" strokeWidth={2.5} fill="currentColor" />
          </div>
        )}
        <div>
          <div className="text-[11px] tracking-[0.16em] font-semibold text-white">
            {logoUrl ? fundName.toUpperCase().slice(0, 12) : "PULSO"}
          </div>
          <div className="text-[10px] text-white/60 mt-0.5">
            {logoUrl ? "Powered by Pulso" : fundName}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 mt-2 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = path === href || path.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                active ? "bg-navy-700 text-white font-medium" : "text-white/70 hover:bg-navy-700 hover:text-white"
              )}
            >
              {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-gold rounded-r" />}
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-3 py-3 space-y-0.5">
        {secondary.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/60 hover:bg-navy-700 hover:text-white transition-colors"
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </div>

      {/* Fund pill */}
      <div className="m-3 p-3 rounded-lg bg-navy-700 border border-white/5">
        <div className="text-[10px] text-gold font-semibold tracking-wider uppercase">Fund</div>
        <div className="text-sm font-semibold text-white mt-1">{fundName}</div>
        <div className="text-[11px] text-white/60 mt-0.5">
          {vintage ? `Vintage ${vintage} · ` : ""}{sizeM}
        </div>
      </div>
    </aside>
  );
}
