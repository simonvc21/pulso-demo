import { Sidebar } from "@/components/sidebar";
import { ChatDock } from "@/components/chat-dock";
import { getFund, parseTheme } from "@/lib/dashboard-data";
import { getServerDictionary } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

function hexToRgb(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return `${(v >> 16) & 255} ${(v >> 8) & 255} ${v & 255}`;
}

// Naive light/dark variants: tint toward white (50) and shade toward black (600/700).
// Good enough for a custom brand palette that needs hover/active states.
function tintRgb(hex: string, alpha: number): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const v = parseInt(m[1], 16);
  const r = (v >> 16) & 255;
  const g = (v >> 8) & 255;
  const b = v & 255;
  // Tint = mix with white at (1-alpha) — alpha closer to 0 means lighter.
  const mix = (channel: number) => Math.round(channel + (255 - channel) * (1 - alpha));
  return `${mix(r)} ${mix(g)} ${mix(b)}`;
}

function shadeRgb(hex: string, alpha: number): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const v = parseInt(m[1], 16);
  const r = (v >> 16) & 255;
  const g = (v >> 8) & 255;
  const b = v & 255;
  const mix = (channel: number) => Math.round(channel * alpha);
  return `${mix(r)} ${mix(g)} ${mix(b)}`;
}

export default async function GpLayout({ children }: { children: React.ReactNode }) {
  const fund = await getFund();
  const theme = parseTheme(fund?.theme_json);
  const dict = getServerDictionary();
  const labels = dict.sidebar as Record<string, string>;

  // Map the user's hex theme into the CSS variable triplets the Tailwind
  // tokens read. Each brand color (navy / teal=primary / gold=accent)
  // gets DEFAULT + 50 (light tint) + 600/700 (darker shades).
  const styleOverrides: Record<string, string> = {};
  if (theme.navy) {
    const base = hexToRgb(theme.navy);
    if (base) {
      styleOverrides["--c-navy"] = base;
      styleOverrides["--c-navy-50"] = tintRgb(theme.navy, 0.12) ?? base;
      styleOverrides["--c-navy-600"] = shadeRgb(theme.navy, 1.25) ?? base;
      styleOverrides["--c-navy-700"] = shadeRgb(theme.navy, 0.85) ?? base;
    }
  }
  if (theme.primary) {
    const base = hexToRgb(theme.primary);
    if (base) {
      styleOverrides["--c-teal"] = base;
      styleOverrides["--c-teal-50"] = tintRgb(theme.primary, 0.12) ?? base;
      styleOverrides["--c-teal-600"] = shadeRgb(theme.primary, 0.78) ?? base;
    }
  }
  if (theme.accent) {
    const base = hexToRgb(theme.accent);
    if (base) {
      styleOverrides["--c-gold"] = base;
      styleOverrides["--c-gold-50"] = tintRgb(theme.accent, 0.18) ?? base;
      styleOverrides["--c-gold-600"] = shadeRgb(theme.accent, 0.78) ?? base;
    }
  }
  // L.12 — chart series color (used by chart components via --c-chart hex string).
  // Falls back to primary so existing funds without a chart override keep working.
  const chartHex = theme.chart ?? theme.primary ?? null;
  if (chartHex) {
    styleOverrides["--c-chart-hex"] = chartHex;
  }

  return (
    <div className="flex min-h-screen" style={styleOverrides as React.CSSProperties}>
      <Sidebar
        fundName={fund?.name ?? "Your fund"}
        vintage={fund?.vintage ?? null}
        sizeUsd={Number(fund?.size_usd ?? 0)}
        logoUrl={fund?.logo_url ?? null}
        labels={{
          overview: labels.overview,
          companies: labels.companies,
          data: labels.data,
          forms: labels.forms,
          lps: labels.lps,
          settings: labels.settings,
          lp_preview: labels.lp_preview,
          founder_preview: labels.founder_preview,
          fund: labels.fund,
        }}
      />
      <main className="flex-1 min-w-0">{children}</main>
      <ChatDock
        scopeHint={`Ask anything about ${fund?.name ?? "your fund"}'s portfolio.`}
        examples={[
          "Which company has the worst runway right now?",
          "What's the biggest news this quarter?",
          "Top 3 by ARR growth QoQ",
          "Who hasn't responded to the last form?",
        ]}
      />
    </div>
  );
}
