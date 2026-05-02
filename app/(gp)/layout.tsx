import { Sidebar } from "@/components/sidebar";
import { ChatDock } from "@/components/chat-dock";
import { getFund, parseTheme } from "@/lib/dashboard-data";
import { getServerDictionary } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function GpLayout({ children }: { children: React.ReactNode }) {
  const fund = await getFund();
  const theme = parseTheme(fund?.theme_json);
  const dict = getServerDictionary();
  const labels = dict.sidebar as Record<string, string>;

  // CSS variables for the brand palette. Kept conservative — only override
  // the navy and gold tokens; everything else falls back to the defaults
  // baked into Tailwind. Components can read these via `style={{ backgroundColor: 'var(--theme-navy)' }}`.
  const styleOverrides: Record<string, string> = {};
  if (theme.navy) styleOverrides["--theme-navy"] = theme.navy;
  if (theme.primary) styleOverrides["--theme-primary"] = theme.primary;
  if (theme.accent) styleOverrides["--theme-accent"] = theme.accent;

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
