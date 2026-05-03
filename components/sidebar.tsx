"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, FileText, Users, Settings, Zap, Share2, Send, Table2, ChevronsLeft, ChevronsRight, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";
import { LocaleSwitcher } from "./locale-switcher";

interface SidebarProps {
  fundName: string;
  vintage: number | null;
  sizeUsd: number;
  logoUrl?: string | null;
  /** L.23 — show the Admin link in the secondary nav. Layout passes this in
   *  from the server-side isCurrentUserAdmin() check. */
  isAdmin?: boolean;
  labels: {
    overview: string;
    companies: string;
    data: string;
    forms: string;
    lps: string;
    settings: string;
    lp_preview: string;
    founder_preview: string;
    fund: string;
  };
}

const COLLAPSE_KEY = "pulso_sidebar_collapsed";

export function Sidebar({ fundName, vintage, sizeUsd, logoUrl, isAdmin = false, labels }: SidebarProps) {
  // Lazily read localStorage so SSR matches the default (expanded).
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1"); } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0"); } catch {}
  }, [collapsed]);

  const nav = [
    { href: "/dashboard", label: labels.overview,  icon: LayoutDashboard },
    { href: "/companies", label: labels.companies, icon: Building2 },
    { href: "/data",      label: labels.data,      icon: Table2 },
    { href: "/forms",     label: labels.forms,     icon: FileText },
    { href: "/lps",       label: labels.lps,       icon: Users },
  ];
  const secondary = [
    { href: "/share/q1-2026-lp-letter?preview=1", label: labels.lp_preview,      icon: Share2 },
    { href: "/fill/q1-2026-financials?preview=1", label: labels.founder_preview, icon: Send },
    { href: "/settings",                          label: labels.settings,         icon: Settings },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: ShieldAlert }] : []),
  ];
  const path = usePathname() || "";
  const sizeM = sizeUsd > 0 ? `$${(sizeUsd / 1_000_000).toFixed(0)}M` : "—";

  return (
    <aside
      className={cn(
        "no-print hidden lg:flex flex-col shrink-0 bg-navy text-white h-screen sticky top-0 self-start transition-all duration-200 relative",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Brand + collapse toggle */}
      <div className={cn("pt-6 pb-5 flex items-center overflow-hidden", collapsed ? "px-2 justify-center" : "px-5 gap-2.5")}>
        {logoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={logoUrl}
            alt={fundName}
            className={cn(
              "rounded-md object-contain bg-white p-0.5 shrink-0",
              collapsed ? "h-9 w-9" : "h-8 w-8"
            )}
          />
        ) : (
          <div className={cn(
            "rounded-full bg-gold flex items-center justify-center shrink-0",
            collapsed ? "h-9 w-9" : "h-8 w-8"
          )}>
            <Zap className="h-4 w-4 text-navy" strokeWidth={2.5} fill="currentColor" />
          </div>
        )}
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="text-[11px] tracking-[0.16em] font-semibold text-white truncate" title={fundName}>
              {logoUrl ? fundName.toUpperCase() : "PULSO"}
            </div>
            <div className="text-[10px] text-white/60 mt-0.5 truncate">
              {logoUrl ? "Powered by Pulso" : fundName}
            </div>
          </div>
        )}
      </div>

      {/* Collapse toggle button — sits on the right edge, halfway down the brand row */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="absolute -right-3 top-8 h-6 w-6 rounded-full bg-navy border border-white/20 text-white/70 hover:text-gold hover:border-gold transition-colors inline-flex items-center justify-center z-50 shadow-md"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronsRight className="h-3 w-3" /> : <ChevronsLeft className="h-3 w-3" />}
      </button>

      {/* Nav */}
      <nav className={cn("flex-1 mt-2 space-y-0.5", collapsed ? "px-2" : "px-3")}>
        {nav.map(({ href, label, icon: Icon }) => {
          const active = path === href || path.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "relative flex items-center rounded-lg text-sm transition-colors",
                collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2",
                active ? "bg-navy-700 text-white font-medium" : "text-white/70 hover:bg-navy-700 hover:text-white"
              )}
            >
              {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-gold rounded-r" />}
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={cn("border-t border-white/10 py-3 space-y-0.5", collapsed ? "px-2" : "px-3")}>
        {secondary.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            title={collapsed ? label : undefined}
            className={cn(
              "flex items-center rounded-lg text-sm text-white/60 hover:bg-navy-700 hover:text-white transition-colors",
              collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </Link>
        ))}
      </div>

      {/* Theme + locale controls — hide labels when collapsed (icons-only) */}
      {!collapsed && (
        <div className="px-3 py-3 border-t border-white/10 flex items-center justify-between gap-2">
          <ThemeToggle />
          <LocaleSwitcher />
        </div>
      )}
      {collapsed && (
        <div className="px-2 py-3 border-t border-white/10 flex flex-col items-center gap-2">
          <ThemeToggle cycle />
        </div>
      )}

      {/* Fund pill — hidden when collapsed */}
      {!collapsed && (
        <div className="m-3 p-3 rounded-lg bg-navy-700 border border-white/5">
          <div className="text-[10px] text-gold font-semibold tracking-wider uppercase">{labels.fund}</div>
          <div className="text-sm font-semibold text-white mt-1 truncate">{fundName}</div>
          <div className="text-[11px] text-white/60 mt-0.5">
            {vintage ? `Vintage ${vintage} · ` : ""}{sizeM}
          </div>
        </div>
      )}
    </aside>
  );
}
