import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { getOrgMembers, getCurrentUser } from "@/lib/dashboard-data";
import { TeamPanel } from "./team-panel";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const [members, profile] = await Promise.all([getOrgMembers(), getCurrentUser()]);

  // The members coming from the RPC use public.users.id, not auth_user_id.
  // We need that id to know which row is "you". Look it up from the current user.
  const me = members.members.find((m) => m.email.toLowerCase() === profile?.email?.toLowerCase());
  const currentUserId = me?.id ?? null;

  return (
    <>
      <Topbar
        title="Team"
        breadcrumb={
          <Link href="/settings" className="inline-flex items-center gap-1 hover:text-ink">
            <ArrowLeft className="h-3 w-3" /> Settings
          </Link>
        }
      />
      <div className="px-8 py-6 max-w-3xl">
        <TeamPanel
          initialMembers={members.members}
          initialInvitations={members.invitations}
          currentUserId={currentUserId}
        />
      </div>
    </>
  );
}
