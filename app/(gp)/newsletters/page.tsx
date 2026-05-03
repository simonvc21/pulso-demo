// L.6 — GP newsletter list.

import Link from "next/link";
import { Topbar } from "@/components/topbar";
import { TopbarBell } from "@/components/topbar-bell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Eye, Pencil, Send } from "lucide-react";
import { listNewsletters } from "@/lib/newsletter";

export const dynamic = "force-dynamic";

export default async function NewslettersPage() {
  const newsletters = await listNewsletters();

  return (
    <>
      <Topbar
        title="Newsletters"
        breadcrumb="Quarterly fund letters · LP-facing"
        bell={<TopbarBell />}
        actions={
          <Link href="/newsletters/new">
            <Button variant="gold" size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New newsletter
            </Button>
          </Link>
        }
      />
      <div className="px-8 py-6 max-w-5xl">
        {newsletters.length === 0 ? (
          <div className="bg-white rounded-2xl border border-line shadow-card p-10 text-center">
            <div className="h-12 w-12 rounded-full bg-paper2 flex items-center justify-center mx-auto">
              <FileText className="h-6 w-6 text-muted" />
            </div>
            <h2 className="mt-4 text-base font-serif font-semibold text-ink">No newsletters yet</h2>
            <p className="mt-2 text-[13px] text-muted max-w-md mx-auto">
              Generate a quarterly recap from your portfolio data in two clicks. The first draft pulls real KPIs, watch list, and standout companies — you edit and publish.
            </p>
            <Link href="/newsletters/new" className="inline-block mt-4">
              <Button variant="gold" size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Create your first newsletter
              </Button>
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {newsletters.map((n) => (
              <li key={n.id}>
                <div className="bg-white rounded-xl border border-line shadow-card p-4 flex items-center gap-4 hover:shadow-cardHover transition-shadow">
                  <div className="h-10 w-10 rounded-lg bg-gold/15 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-gold-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-ink truncate">{n.coverTitle}</h3>
                      {n.status === "published" ? (
                        <Badge tone="teal">Published</Badge>
                      ) : (
                        <Badge>Draft</Badge>
                      )}
                      <Badge>{n.cadence === "ad_hoc" ? "Ad-hoc" : n.cadence}</Badge>
                    </div>
                    <div className="text-[11px] text-muted mt-0.5 truncate">
                      {n.periodLabel}
                      {n.publishedAt && (
                        <> · published {new Date(n.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</>
                      )}
                      {n.heroMetricSummary && <> · {n.heroMetricSummary}</>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Link href={`/newsletters/${n.id}`}>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <Eye className="h-3.5 w-3.5" /> Preview
                      </Button>
                    </Link>
                    <Link href={`/newsletters/${n.id}/edit`}>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
