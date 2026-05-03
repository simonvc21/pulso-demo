// L.6 — GP preview of a newsletter (draft or published).

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Printer } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { TopbarBell } from "@/components/topbar-bell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getNewsletter } from "@/lib/newsletter";
import { NewsletterRenderer } from "@/components/newsletter-renderer";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

export default async function NewsletterPreviewPage({ params }: { params: { id: string } }) {
  const newsletter = await getNewsletter(params.id);
  if (!newsletter) notFound();

  return (
    <>
      <Topbar
        title={newsletter.coverTitle}
        breadcrumb={
          <Link href="/newsletters" className="inline-flex items-center gap-1 hover:text-ink">
            <ArrowLeft className="h-3 w-3" /> Newsletters
          </Link>
        }
        bell={<TopbarBell />}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={newsletter.status === "published" ? "teal" : "default"}>
              {newsletter.status === "published" ? "Published" : "Draft"}
            </Badge>
            <PrintButton />
            <Link href={`/newsletters/${newsletter.id}/edit`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            </Link>
          </div>
        }
      />
      <div className="bg-paper2/40 min-h-[calc(100vh-65px)] py-8 px-4 newsletter-page">
        <div className="rounded-2xl shadow-card overflow-hidden">
          <NewsletterRenderer newsletter={newsletter} />
        </div>
      </div>
    </>
  );
}
