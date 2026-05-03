import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert, Flag, Wrench, ArrowLeft, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isCurrentUserAdmin } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

/** Gated admin shell. Anyone non-admin gets bounced. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const admin = await isCurrentUserAdmin();
  if (!admin) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-paper">
      {/* Top bar — visually distinct so admins know they're in danger zone. */}
      <header className="bg-coral text-white border-b border-coral/20">
        <div className="max-w-6xl mx-auto px-6 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-full bg-white/15 flex items-center justify-center">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[10px] tracking-[0.18em] font-semibold uppercase">Pulso · Admin</div>
              <div className="text-[10px] opacity-80">Cross-org system tools — destructive actions live here</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[12px]">
            <Link href="/admin" className="hover:underline">Hub</Link>
            <Link href="/admin/feature-flags" className="hover:underline inline-flex items-center gap-1">
              <Flag className="h-3 w-3" /> Feature flags
            </Link>
            <Link href="/admin/system-tools" className="hover:underline inline-flex items-center gap-1">
              <Wrench className="h-3 w-3" /> System tools
            </Link>
            <Link href="/dashboard" className="hover:underline inline-flex items-center gap-1 ml-2 opacity-90">
              <ArrowLeft className="h-3 w-3" /> Exit admin
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
