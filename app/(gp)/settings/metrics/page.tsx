// L.4b — Metric library page. Lists every metric in the fund and lets the
// GP apply each to N companies in one click.

import { Topbar } from "@/components/topbar";
import { TopbarBell } from "@/components/topbar-bell";
import { getMetricLibrary } from "@/lib/metric-library";
import { MetricLibraryClient } from "./metric-library-client";
import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";

export default async function MetricLibraryPage() {
  noStore();
  const lib = await getMetricLibrary();

  return (
    <>
      <Topbar
        title="Metric library"
        breadcrumb="Settings · Metrics"
        bell={<TopbarBell />}
      />
      <div className="px-8 py-6 space-y-6 animate-fade-in max-w-5xl">
        <MetricLibraryClient metrics={lib.metrics} companies={lib.companies} />
      </div>
    </>
  );
}
