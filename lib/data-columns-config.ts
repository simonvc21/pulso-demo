// Client-safe parser + types for /data spreadsheet column config (L.3).
// No server-only deps — imported by both the loader (server) and the
// DataGrid (client).

import { DATA_METRICS, type DataMetricKey } from "./data-metrics";

export interface DataColumnsConfig {
  /** Order of metric keys, left-to-right. Unknown keys are dropped; missing
   *  keys are appended at the end so new metrics show up automatically. */
  order: DataMetricKey[];
  /** Subset of `order` that should be hidden from view. */
  hidden: DataMetricKey[];
}

const VALID_KEYS = new Set<string>(DATA_METRICS.map((m) => m.key));

export function defaultDataColumnsConfig(): DataColumnsConfig {
  return {
    order: DATA_METRICS.map((m) => m.key),
    hidden: [],
  };
}

export function parseDataColumnsConfig(raw: unknown): DataColumnsConfig {
  if (!raw || typeof raw !== "object") return defaultDataColumnsConfig();
  const r = raw as Record<string, unknown>;

  const inOrder = Array.isArray(r.order) ? (r.order as unknown[]) : [];
  const inHidden = Array.isArray(r.hidden) ? (r.hidden as unknown[]) : [];

  const seen = new Set<DataMetricKey>();
  const order: DataMetricKey[] = [];
  for (const k of inOrder) {
    if (typeof k !== "string" || !VALID_KEYS.has(k)) continue;
    if (seen.has(k as DataMetricKey)) continue;
    seen.add(k as DataMetricKey);
    order.push(k as DataMetricKey);
  }
  // Forward-compat: append any new keys the user hasn't seen yet.
  for (const k of DATA_METRICS.map((m) => m.key)) {
    if (!seen.has(k)) order.push(k);
  }

  const hidden: DataMetricKey[] = [];
  for (const k of inHidden) {
    if (typeof k !== "string" || !VALID_KEYS.has(k)) continue;
    if (!hidden.includes(k as DataMetricKey)) hidden.push(k as DataMetricKey);
  }

  return { order, hidden };
}
