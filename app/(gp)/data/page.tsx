import { Topbar } from "@/components/topbar";
import { TopbarBell } from "@/components/topbar-bell";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { getDataMatrix } from "@/lib/dashboard-data";
import { DataGrid } from "./data-grid";
import { MetricsCsvImport } from "@/components/metrics-csv-import";

export const dynamic = "force-dynamic";

export default async function DataPage() {
  const matrix = await getDataMatrix();

  return (
    <>
      <Topbar
        title="Data"
        breadcrumb={`${matrix.companies.length} companies · ${matrix.quarters.length} quarters · click any cell to edit`}
        bell={<TopbarBell />}
        actions={
          <div className="flex items-center gap-2">
            <MetricsCsvImport />
            <a href="/api/export/metrics?format=csv">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Export CSV
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
        />
      </div>
    </>
  );
}
