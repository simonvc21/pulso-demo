// L.5c — GP-side LP chat thread.

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { TopbarBell } from "@/components/topbar-bell";
import { createClient } from "@/lib/supabase/server";
import { getLpThread } from "@/lib/lp-chat";
import { LpChatPanel } from "@/components/lp-chat-panel";
import { getCurrentUser, getFund } from "@/lib/dashboard-data";
import { markLpThreadRead } from "../../chat-actions";

export const dynamic = "force-dynamic";

export default async function LpChatPage({ params }: { params: { lpId: string } }) {
  const supabase = createClient();
  const { data: lp } = await supabase
    .from("lps")
    .select("id, name")
    .eq("id", params.lpId)
    .maybeSingle();
  if (!lp) notFound();

  const [thread, currentUser, fund] = await Promise.all([
    getLpThread(lp.id),
    getCurrentUser(),
    getFund(),
  ]);

  // Mark every LP-side message as read so the unread badge clears next render.
  await markLpThreadRead({ lpId: lp.id });

  return (
    <>
      <Topbar
        title={lp.name}
        breadcrumb={
          <Link href="/lps" className="inline-flex items-center gap-1 hover:text-ink">
            <ArrowLeft className="h-3 w-3" /> Back to LPs
          </Link>
        }
        bell={<TopbarBell />}
      />
      <div className="px-8 py-6 max-w-3xl">
        <LpChatPanel
          lpId={lp.id}
          lpName={lp.name}
          fundName={fund?.name ?? "Your fund"}
          initial={thread}
          viewerRole="gp"
          currentUserId={currentUser?.authUserId ?? null}
          currentUserName={currentUser?.name ?? null}
        />
      </div>
    </>
  );
}
