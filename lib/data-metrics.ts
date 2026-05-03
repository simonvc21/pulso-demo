// Pure constants + types for the /data spreadsheet view. Safe to import
// from client components (no Supabase / next/headers dependency).

export const DATA_METRICS = [
  { key: "arr_usd",     label: "ARR (USD)",        type: "currency" as const },
  { key: "burn_usd",    label: "Burn (USD/mo)",    type: "currency" as const },
  { key: "cash_usd",    label: "Cash (USD)",       type: "currency" as const },
  { key: "revenue_usd", label: "Revenue (USD)",    type: "currency" as const },
  { key: "headcount",   label: "Headcount",        type: "number"   as const },
] as const;

export type DataMetricKey = (typeof DATA_METRICS)[number]["key"];
