// L.5c — LP-side chat with their fund.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUsersLpId, getLpThread } from "@/lib/lp-chat";
import { getCurrentUser, getFund } from "@/lib/dashboard-data";
import { LpChatPanel } from "@/components/lp-chat-panel";
import { markLpThreadRead } from "@/app/(gp)/lps/chat-actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LpMessagesPage() {
  const lpId = await getCurrentUsersLpId();
  const [currentUser, fund] = await Promise.all([getCurrentUser(), getFund()]);

  if (!lpId) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link href="/lp" className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-ink">
          <ArrowLeft className="h-3 w-3" /> Back
        </Link>
        <div className="mt-6 bg-white rounded-2xl border border-line shadow-card p-8 text-center">
          <h1 className="text-xl font-serif font-bold text-ink">Chat unavailable</h1>
          <p className="text-sm text-muted mt-2">
            We couldn't find your LP profile. Ask {fund?.name ?? "your fund"} to add your email
            to their LP roster so you can message them here.
          </p>
        </div>
      </div>
    );
  }

  // Resolve LP name for the panel header.
  const supabase = createClient();
  const { data: lp } = await supabase
    .from("lps")
    .select("name")
    .eq("id", lpId)
    .maybeSingle();

  const thread = await getLpThread(lpId);
  await markLpThreadRead({ lpId });

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
      <Link href="/lp" className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-ink">
        <ArrowLeft className="h-3 w-3" /> Back to portal
      </Link>
      <LpChatPanel
        lpId={lpId}
        lpName={lp?.name ?? "You"}
        fundName={fund?.name ?? "Your fund"}
        initial={thread}
        viewerRole="lp"
        currentUserId={currentUser?.authUserId ?? null}
        currentUserName={currentUser?.name ?? null}
      />
    </div>
  );
}
