// Client-safe dashboard config types + parser. Imported by both server (loader,
// server actions) and client (DashboardEditor). MUST NOT import next/headers
// or any server-only Supabase helper.

export type DashboardWidgetId =
  | "ai_banner"
  | "kpis"
  | "arr_by_company"
  | "watch_list"
  | "arr_trend"
  | "activity"
  | "newsletter";

export type DashboardWidgetSize = "S" | "M" | "L" | "XL";
export type DashboardWidgetAccent = "default" | "primary" | "accent" | "navy" | "muted";

export interface DashboardWidgetConfig {
  id: DashboardWidgetId;
  hidden?: boolean;
  size?: DashboardWidgetSize;
  accent?: DashboardWidgetAccent;
}

export interface DashboardConfig {
  widgets: DashboardWidgetConfig[];
  titleSize?: "sm" | "md" | "lg";
  density?: "comfortable" | "compact";
}

export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  widgets: [
    { id: "ai_banner", size: "XL" },
    { id: "kpis", size: "XL" },
    { id: "arr_by_company", size: "L" },
    { id: "watch_list", size: "M" },
    { id: "arr_trend", size: "L" },
    { id: "activity", size: "M" },
    { id: "newsletter", size: "XL" },
  ],
  titleSize: "md",
  density: "comfortable",
};

const WIDGET_IDS: DashboardWidgetId[] = [
  "ai_banner", "kpis", "arr_by_company", "watch_list", "arr_trend", "activity", "newsletter",
];
const SIZES: DashboardWidgetSize[] = ["S", "M", "L", "XL"];
const ACCENTS: DashboardWidgetAccent[] = ["default", "primary", "accent", "navy", "muted"];

export function parseDashboardConfig(raw: unknown): DashboardConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_DASHBOARD_CONFIG;
  const r = raw as Record<string, unknown>;
  const inWidgets = Array.isArray(r.widgets) ? r.widgets : [];
  const seen = new Set<DashboardWidgetId>();
  const widgets: DashboardWidgetConfig[] = [];

  for (const w of inWidgets) {
    if (!w || typeof w !== "object") continue;
    const ww = w as Record<string, unknown>;
    const id = ww.id;
    if (typeof id !== "string" || !WIDGET_IDS.includes(id as DashboardWidgetId)) continue;
    if (seen.has(id as DashboardWidgetId)) continue;
    seen.add(id as DashboardWidgetId);
    widgets.push({
      id: id as DashboardWidgetId,
      hidden: ww.hidden === true,
      size: SIZES.includes(ww.size as DashboardWidgetSize) ? (ww.size as DashboardWidgetSize) : undefined,
      accent: ACCENTS.includes(ww.accent as DashboardWidgetAccent) ? (ww.accent as DashboardWidgetAccent) : undefined,
    });
  }
  for (const def of DEFAULT_DASHBOARD_CONFIG.widgets) {
    if (!seen.has(def.id)) widgets.push(def);
  }

  const titleSize = ["sm", "md", "lg"].includes(r.titleSize as string)
    ? (r.titleSize as DashboardConfig["titleSize"])
    : "md";
  const density = ["comfortable", "compact"].includes(r.density as string)
    ? (r.density as DashboardConfig["density"])
    : "comfortable";

  return { widgets, titleSize, density };
}
