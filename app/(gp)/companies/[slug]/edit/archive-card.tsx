"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { archiveCompany, unarchiveCompany } from "../../actions";

interface Props {
  slug: string;
  name: string;
  archivedAt: string | null;
}

export function ArchiveCard({ slug, name, archivedAt }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isArchived = !!archivedAt;

  const archive = () => {
    if (!confirm(`Archive "${name}"? It will be hidden from dashboards and pickers, but kept in the database. You can restore it any time.`)) return;
    startTransition(async () => {
      const res = await archiveCompany(slug);
      if (!res.ok) { alert(res.error); return; }
      router.refresh();
      router.push("/companies");
    });
  };

  const restore = () => {
    startTransition(async () => {
      const res = await unarchiveCompany(slug);
      if (!res.ok) { alert(res.error); return; }
      router.refresh();
    });
  };

  return (
    <div className="bg-white rounded-xl border border-line shadow-card overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-line">
        <h3 className="text-sm font-semibold text-ink">
          {isArchived ? "Archived" : "Archive company"}
        </h3>
        <p className="text-[11px] text-muted mt-0.5">
          {isArchived
            ? `Archived on ${new Date(archivedAt!).toLocaleDateString("en-US", { dateStyle: "medium" })}. Hidden from dashboards and pickers.`
            : "Hide this company from dashboards, pickers, and exports without deleting any data. Reversible."}
        </p>
      </div>
      <div className="px-5 py-4">
        {isArchived ? (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={restore} disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            Restore company
          </Button>
        ) : (
          <button
            type="button"
            onClick={archive}
            disabled={pending}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md border border-coral/40 text-coral text-sm hover:bg-coral/10 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
            Archive {name}
          </button>
        )}
      </div>
    </div>
  );
}
