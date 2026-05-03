// L.6 — LP-side newsletter reader.

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getNewsletter } from "@/lib/newsletter";
import { NewsletterRenderer } from "@/components/newsletter-renderer";
import { PrintButton } from "@/app/(gp)/newsletters/[id]/print-button";

export const dynamic = "force-dynamic";

export default async function LpNewsletterPage({ params }: { params: { id: string } }) {
  const newsletter = await getNewsletter(params.id);
  // RLS already filters to published-or-GP-side. If LPs hit a draft, they
  // get null and 404 here.
  if (!newsletter || newsletter.status !== "published") notFound();

  return (
    <div className="bg-paper2/40 min-h-[calc(100vh-65px)] py-8 newsletter-page">
      <div className="max-w-3xl mx-auto px-6 mb-3 flex items-center justify-between no-print">
        <Link href="/lp/newsletters" className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-ink">
          <ArrowLeft className="h-3 w-3" /> Back to letters
        </Link>
        <PrintButton />
      </div>
      <div className="rounded-2xl shadow-card overflow-hidden mx-auto max-w-3xl">
        <NewsletterRenderer newsletter={newsletter} />
      </div>
    </div>
  );
}
