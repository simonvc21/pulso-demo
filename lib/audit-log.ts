// L.7 — Audit log loader. Server-only.

import { createClient } from "@/lib/supabase/server";

export interface AuditEntry {
  id: number;
  createdAt: string;
  actorEmail: string | null;
  actorUserId: string | null;
  tableName: string;
  rowId: string;
  action: "insert" | "update" | "delete";
  summary: string | null;
  beforeJson: Record<string, any> | null;
  afterJson: Record<string, any> | null;
}

export interface ListOpts {
  limit?: number;
  tableName?: string;
  actorUserId?: string;
  rowId?: string;
}

export async function listAuditLog(opts: ListOpts = {}): Promise<AuditEntry[]> {
  const supabase = createClient();
  let q = (supabase as any)
    .from("audit_log")
    .select("id, created_at, actor_email, actor_user_id, table_name, row_id, action, summary, before_json, after_json")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.tableName) q = q.eq("table_name", opts.tableName);
  if (opts.actorUserId) q = q.eq("actor_user_id", opts.actorUserId);
  if (opts.rowId) q = q.eq("row_id", opts.rowId);
  const { data } = await q;
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    actorEmail: r.actor_email,
    actorUserId: r.actor_user_id,
    tableName: r.table_name,
    rowId: r.row_id,
    action: r.action,
    summary: r.summary,
    beforeJson: r.before_json,
    afterJson: r.after_json,
  }));
}
