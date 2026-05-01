import { Sidebar } from "@/components/sidebar";
import { ChatDock } from "@/components/chat-dock";
import { getFund } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function GpLayout({ children }: { children: React.ReactNode }) {
  const fund = await getFund();
  return (
    <div className="flex min-h-screen">
      <Sidebar
        fundName={fund?.name ?? "Your fund"}
        vintage={fund?.vintage ?? null}
        sizeUsd={Number(fund?.size_usd ?? 0)}
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
