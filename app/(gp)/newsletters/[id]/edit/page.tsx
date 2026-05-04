// L.6 — Newsletter block editor.

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { TopbarBell } from "@/components/topbar-bell";
import { getNewsletter } from "@/lib/newsletter";
import { getCompanyOptions, getFund } from "@/lib/dashboard-data";
import { NewsletterEditor } from "./editor";

export const dynamic = "force-dynamic";

export default async function NewsletterEditPage({ params }: { params: { id: string } }) {
  const newsletter = await getNewsletter(params.id);
  if (!newsletter) notFound();

  const [companies, fund] = await Promise.all([
    getCompanyOptions(),
    getFund(),
  ]);
  const fundName = fund?.name ?? "Your fund";

  return (
    <>
      <Topbar
        title={`Edit · ${newsletter.coverTitle}`}
        breadcrumb={
          <Link href="/newsletters" className="inline-flex items-center gap-1 hover:text-ink">
            <ArrowLeft className="h-3 w-3" /> Back to newsletters
          </Link>
        }
        bell={<TopbarBell />}
      />
      <NewsletterEditor
        newsletter={newsletter}
        companies={companies}
        fundName={fundName}
      />
    </>
  );
}
