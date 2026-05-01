import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail, LogOut, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/(gp)/settings/actions";

export const dynamic = "force-dynamic";

export default async function LpLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/lp");

  // Show GP banner if a GP somehow lands here so they can navigate back.
  const { data: profile } = await supabase
    .from("users")
    .select("role, name, email")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const isLp = profile?.role === "lp";

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy text-white border-b border-white/5">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/lp" className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-full bg-gold flex items-center justify-center">
              <Zap className="h-3.5 w-3.5 text-navy" fill="currentColor" />
            </div>
            <div>
              <div className="text-[11px] tracking-[0.18em] font-semibold">PULSO · LP PORTAL</div>
              <div className="text-[10px] text-white/60">{profile?.email ?? user.email}</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            {!isLp && (
              <Link href="/dashboard">
                <Button variant="outline" size="sm" className="gap-1.5 bg-white/10 border-white/20 text-white hover:bg-white/20">
                  Switch to GP view
                </Button>
              </Link>
            )}
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm" className="gap-1.5 bg-white/10 border-white/20 text-white hover:bg-white/20">
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
