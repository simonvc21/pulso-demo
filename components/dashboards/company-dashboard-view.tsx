// L.10 / Fase 1.D — Reusable read-only view of a company's sheet.
// Used by /dashboards/companies/[slug] (GP) and /d/[token] (public share).

import { createClient } from "@/lib/supabase/server";
import { KpiStrip } from "@/components/sheets/KpiStrip";
import { SheetChart } from "@/components/sheets/SheetChart";
import {
  type SheetColumn,
  type SheetRow,
  type ColumnConfig,
  type ColumnType,
} from "@/components/sheets/types";

interface Props {
  companyId: string;
}

export async function CompanyDashboardView({ companyId }: Props) {
  const supabase = createClient();

  const { data: sheet } = await supabase
    .from("sheets")
    .select("id")
    .eq("company_id", companyId)
    .maybeSingle();

  if (!sheet) {
    return (
      <div className="bg-white rounded-xl border border-line p-8 text-center text-sm text-muted">
        No data captured yet.
      </div>
    );
  }

  const [columnsRes, rowsRes] = await Promise.all([
    supabase.from("sheet_columns").select("id, sheet_id, name, type, config, position").eq("sheet_id", sheet.id).order("position"),
    supabase.from("sheet_rows").select("id, sheet_id, data, position").eq("sheet_id", sheet.id).order("position"),
  ]);

  const columns: SheetColumn[] = (columnsRes.data ?? []).map((c) => ({
    id: c.id, sheet_id: c.sheet_id, name: c.name,
    type: c.type as ColumnType, config: (c.config ?? {}) as ColumnConfig, position: c.position,
  }));
  const rows: SheetRow[] = (rowsRes.data ?? []).map((r) => ({
    id: r.id, sheet_id: r.sheet_id, data: (r.data ?? {}) as Record<string, any>, position: r.position,
  }));

  return (
    <div className="space-y-5">
      <KpiStrip columns={columns} rows={rows} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SheetChart columns={columns} rows={rows} index={0} />
        <SheetChart columns={columns} rows={rows} index={1} />
      </div>
    </div>
  );
}
