import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { listAllFlags } from "@/lib/feature-flags";
import { FlagsGrid } from "./flags-grid";

export const dynamic = "force-dynamic";

export default async function FeatureFlagsPage() {
  noStore();
  const supabase = createClient();

  const [{ data: orgs }, { data: overrides }] = await Promise.all([
    supabase.from("organizations").select("id, name, slug").order("name"),
    supabase.from("feature_flags").select("organization_id, flag_name, enabled, notes, updated_at"),
  ]);

  const allFlags = listAllFlags();

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-serif font-bold text-ink">Feature flags</h1>
        <p className="mt-1 text-sm text-muted">
          Per-org overrides on top of the in-code defaults (defined in <code className="bg-paper2 px-1 rounded text-[11px]">lib/feature-flags.ts</code>). Empty cell = falls back to default.
        </p>
      </div>

      <FlagsGrid
        organizations={(orgs ?? []) as any[]}
        flags={allFlags}
        overrides={(overrides ?? []) as any[]}
      />
    </div>
  );
}
