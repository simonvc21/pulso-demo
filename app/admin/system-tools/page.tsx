import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SystemToolsClient } from "./system-tools-client";

export const dynamic = "force-dynamic";

export default async function SystemToolsPage() {
  noStore();
  const supabase = createClient();

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .order("name");

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-serif font-bold text-ink">System tools</h1>
        <p className="mt-1 text-sm text-muted">
          Destructive actions for keeping production healthy. Each tool confirms before firing.
        </p>
      </div>

      <SystemToolsClient organizations={(orgs ?? []) as any[]} />
    </div>
  );
}
