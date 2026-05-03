import { Topbar } from "@/components/topbar";
import { TopbarBell } from "@/components/topbar-bell";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { getDataMatrix } from "@/lib/dashboard-data";
import { DataGrid } from "./data-grid";
import { MetricsCsvImport } from "@/components/metrics-csv-import";
import { ts, getServerLocale } from "@/lib/i18n-server";
import { getDictionary } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function DataPage() {
  const matrix = await getDataMatrix();
  const locale = getServerLocale();
  const dict = getDictionary(locale).data ?? {};

  return (
    <>
      <Topbar
        title={ts("data.title")}
        breadcrumb={ts("data.breadcrumb", {
          n: matrix.companies.length,
          q: matrix.quarters.length,
        })}
        bell={<TopbarBell />}
        actions={
          <div className="flex items-center gap-2">
            <MetricsCsvImport buttonLabel={ts("data.import_csv")} />
            <a href="/api/export/metrics?format=csv">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> {ts("data.export_csv")}
              </Button>
            </a>
          </div>
        }
      />
      <div className="px-8 py-6 animate-fade-in">
        <DataGrid
          quarters={matrix.quarters}
          companies={matrix.companies}
          initialNotes={matrix.notes}
          initialColumns={matrix.columnsConfig}
          dict={dict}
        />
      </div>
    </>
  );
}
