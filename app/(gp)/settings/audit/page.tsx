// L.7 — Audit log viewer.

import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { TopbarBell } from "@/components/topbar-bell";
import { Badge } from "@/components/ui/badge";
import { listAuditLog, type AuditEntry } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

const TABLE_LABEL: Record<string, string> = {
  metrics: "Metrics",
  companies: "Company",
  newsletters: "Newsletter",
  form_submissions: "Form submission",
};

export default async function AuditLogPage({
  searchParams,
}: { searchParams: { table?: string } }) {
  const tableName = searchParams?.table;
  const entries = await listAuditLog({ limit: 200, tableName });

  return (
    <>
      <Topbar
        title="Audit log"
        breadcrumb={
          <Link href="/settings" className="inline-flex items-center gap-1 hover:text-ink">
            <ArrowLeft className="h-3 w-3" /> Settings
          </Link>
        }
        bell={<TopbarBell />}
      />
      <div className="px-8 py-6 max-w-5xl space-y-4">
        <div className="bg-white rounded-xl border border-line shadow-card p-4 flex items-start gap-3">
          <FileText className="h-5 w-5 text-muted shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-ink">What changed, who did it, when</h2>
            <p className="text-[12px] text-muted mt-1">
              Every metric edit, company profile change, newsletter publish, and form submission
              is logged here. Use this when an LP asks "this number changed since last quarter."
            </p>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link
            href="/settings/audit"
            className={`text-[11px] px-2 py-1 rounded-md border ${!tableName ? "bg-navy text-white border-navy" : "bg-white text-muted border-line hover:text-ink"}`}
          >
            All
          </Link>
          {Object.entries(TABLE_LABEL).map(([key, label]) => (
            <Link
              key={key}
              href={`/settings/audit?table=${key}`}
              className={`text-[11px] px-2 py-1 rounded-md border ${tableName === key ? "bg-navy text-white border-navy" : "bg-white text-muted border-line hover:text-ink"}`}
            >
              {label}
            </Link>
          ))}
        </div>

        {entries.length === 0 ? (
          <div className="bg-white rounded-xl border border-line shadow-card p-8 text-center">
            <p className="text-[13px] text-muted">No audit entries yet.</p>
          </div>
        ) : (
          <ul className="bg-white rounded-xl border border-line shadow-card divide-y divide-line">
            {entries.map((e) => (
              <li key={e.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <ActionDot action={e.action} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-ink font-medium">{e.summary ?? `${e.action} on ${e.tableName}`}</span>
                      <Badge>{TABLE_LABEL[e.tableName] ?? e.tableName}</Badge>
                    </div>
                    <div className="text-[11px] text-muted mt-0.5">
                      {e.actorEmail ? <>by <strong className="text-ink">{e.actorEmail}</strong></> : <em>(anonymous · founder fill or system)</em>}
                      {" · "}
                      {new Date(e.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                    </div>
                    {e.action === "update" && e.beforeJson && e.afterJson && (
                      <Diff before={e.beforeJson} after={e.afterJson} />
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="text-[10px] text-muted text-center">
          Showing latest {entries.length} entries{tableName ? ` for ${TABLE_LABEL[tableName] ?? tableName}` : ""}.
          Logs are retained indefinitely.
        </div>
      </div>
    </>
  );
}

function ActionDot({ action }: { action: AuditEntry["action"] }) {
  const cls = action === "insert" ? "bg-teal-600" : action === "update" ? "bg-gold-600" : "bg-coral";
  return <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${cls}`} />;
}

function Diff({ before, after }: { before: Record<string, any>; after: Record<string, any> }) {
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  const changed = keys.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
  if (changed.length === 0) return null;
  return (
    <div className="mt-2 rounded-md border border-line bg-paper2/40 p-2 text-[11px] font-mono">
      {changed.map((k) => (
        <div key={k} className="flex items-baseline gap-2">
          <span className="text-muted shrink-0">{k}:</span>
          <span className="text-coral line-through tabular-nums">{fmt(before[k])}</span>
          <span className="text-muted">→</span>
          <span className="text-teal-600 tabular-nums">{fmt(after[k])}</span>
        </div>
      ))}
    </div>
  );
}

function fmt(v: any): string {
  if (v == null) return "null";
  if (typeof v === "number") return v.toLocaleString("en-US");
  if (typeof v === "string") return v.length > 80 ? v.slice(0, 77) + "…" : v;
  return JSON.stringify(v);
}
