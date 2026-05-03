import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { TopbarBell } from "@/components/topbar-bell";
import { getOrgMembers, getCurrentUser, getCompanyOptions } from "@/lib/dashboard-data";
import { isAdminRole } from "@/lib/roles";
import { TeamPanel } from "./team-panel";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const [members, profile, companies] = await Promise.all([
    getOrgMembers(),
    getCurrentUser(),
    getCompanyOptions(),
  ]);

  const me = members.members.find((m) => m.email.toLowerCase() === profile?.email?.toLowerCase());
  const currentUserId = me?.id ?? null;
  const canManage = isAdminRole(profile?.role);

  return (
    <>
      <Topbar
        bell={<TopbarBell />}
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
          canManage={canManage}
          companies={companies}
        />
      </div>
    </>
  );
}
