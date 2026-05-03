import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail, LogOut, Zap, Briefcase, FileText, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatDock } from "@/components/chat-dock";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/(gp)/settings/actions";
import { ts } from "@/lib/i18n-server";

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
              <div className="text-[11px] tracking-[0.18em] font-semibold">PULSO · {ts("lp_portal.header").toUpperCase()}</div>
              <div className="text-[10px] text-white/60">{profile?.email ?? user.email}</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/lp">
              <Button variant="outline" size="sm" className="gap-1.5 bg-white/10 border-white/20 text-white hover:bg-white/20">
                <FileText className="h-3.5 w-3.5" /> {ts("lp_portal.letters_btn")}
              </Button>
            </Link>
            <Link href="/lp/portfolio">
              <Button variant="outline" size="sm" className="gap-1.5 bg-white/10 border-white/20 text-white hover:bg-white/20">
                <BarChart3 className="h-3.5 w-3.5" /> Fund overview
              </Button>
            </Link>
            <Link href="/lp/companies">
              <Button variant="outline" size="sm" className="gap-1.5 bg-white/10 border-white/20 text-white hover:bg-white/20">
                <Briefcase className="h-3.5 w-3.5" /> {ts("lp_portal.portfolio_btn")}
              </Button>
            </Link>
            {!isLp && (
              <Link href="/dashboard">
                <Button variant="outline" size="sm" className="gap-1.5 bg-white/10 border-white/20 text-white hover:bg-white/20">
                  {ts("lp_portal.switch_to_gp")}
                </Button>
              </Link>
            )}
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm" className="gap-1.5 bg-white/10 border-white/20 text-white hover:bg-white/20">
                <LogOut className="h-3.5 w-3.5" /> {ts("settings.sign_out")}
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <ChatDock
        scopeHint="Ask about your fund's portfolio. I'll only show you what your GP has shared."
        examples={[
          "How is the portfolio performing this quarter?",
          "What's the latest news from the companies?",
          "Summarize the most recent letter for me",
          "Which sectors am I most exposed to?",
        ]}
      />
    </div>
  );
}
