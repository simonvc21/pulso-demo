import Link from "next/link";
import { Flag, Wrench, Database, Users, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";

export default async function AdminHubPage() {
  noStore();
  const supabase = createClient();

  // Quick org/user counts so the hub feels live.
  const [{ count: orgCount }, { count: userCount }, { count: flagCount }] = await Promise.all([
    supabase.from("organizations").select("*", { count: "exact", head: true }),
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase.from("feature_flags").select("*", { count: "exact", head: true }),
  ]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-serif font-bold text-ink">Admin hub</h1>
        <p className="mt-1 text-sm text-muted">
          Cross-org system controls. Every action here bypasses normal RLS — measure twice.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Organizations" value={String(orgCount ?? 0)} />
        <Stat label="Users" value={String(userCount ?? 0)} />
        <Stat label="Active flag overrides" value={String(flagCount ?? 0)} />
        <Stat label="Your role" value="Admin" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Tile
          href="/admin/feature-flags"
          icon={Flag}
          title="Feature flags"
          body="Toggle features per org. Defaults live in lib/feature-flags.ts."
        />
        <Tile
          href="/admin/system-tools"
          icon={Wrench}
          title="System tools"
          body="Reset AI usage, force onboarding, re-run metric alerts."
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-line p-4 shadow-card">
      <div className="text-[10px] font-semibold text-muted tracking-[0.14em] uppercase">{label}</div>
      <div className="mt-1 font-serif text-2xl font-bold text-ink leading-none">{value}</div>
    </div>
  );
}

function Tile({ href, icon: Icon, title, body }: { href: string; icon: any; title: string; body: string }) {
  return (
    <Link href={href} className="group">
      <div className="bg-white rounded-xl border border-line shadow-card hover:shadow-cardHover transition-shadow p-5 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-coral/10 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-coral" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-ink">{title}</div>
          <div className="text-[11px] text-muted mt-0.5">{body}</div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted group-hover:text-ink" />
      </div>
    </Link>
  );
}
