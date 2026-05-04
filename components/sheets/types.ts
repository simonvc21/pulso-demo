// L.10 / Fase 1.5 — Shared types for the sheets UI. Pure types — safe to
// import from both server and client components.

export type ColumnType =
  | "text"
  | "long_text"
  | "number"
  | "currency"
  | "percent"
  | "date"
  | "single_select"
  | "checkbox"
  | "attachment_url";

export interface SelectOption {
  id: string;
  label: string;
  /** Tailwind brand token: teal | gold | coral | navy | muted | etc. */
  color?: string;
}

export interface ColumnConfig {
  // text / long_text → none
  // number
  decimals?: number;
  thousand_sep?: boolean;
  prefix?: string;
  suffix?: string;
  // currency
  currency?: "USD" | "ARS" | "BRL" | "CLP" | "MXN" | "COP" | "EUR";
  // percent → decimals
  // date
  time?: boolean;
  format?: "yyyy-mm-dd" | "MMM yyyy" | "d MMM";
  // single_select
  options?: SelectOption[];
  // attachment_url / checkbox → none
}

export interface SheetColumn {
  id: string;
  sheet_id: string;
  name: string;
  type: ColumnType;
  config: ColumnConfig;
  position: number;
}

export interface SheetRow {
  id: string;
  sheet_id: string;
  data: Record<string, any>;
  position: number;
}

export interface Sheet {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  position: number;
}

export const COLUMN_TYPE_LABELS: Record<ColumnType, string> = {
  text: "Text",
  long_text: "Long text",
  number: "Number",
  currency: "Currency",
  percent: "Percent",
  date: "Date",
  single_select: "Single select",
  checkbox: "Checkbox",
  attachment_url: "Link / URL",
};

// Tailwind chip colors keyed by single_select option color name.
export const SELECT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  teal:  { bg: "bg-teal-50",  text: "text-teal-600",  border: "border-teal/40" },
  gold:  { bg: "bg-gold-50",  text: "text-gold-600",  border: "border-gold/40" },
  coral: { bg: "bg-coral/10", text: "text-coral",     border: "border-coral/40" },
  navy:  { bg: "bg-navy/10",  text: "text-navy",      border: "border-navy/30" },
  muted: { bg: "bg-paper2",   text: "text-muted",     border: "border-line" },
};

// ---------------------------------------------------------------------------
// Display formatters per type. Centralized so cells, KPIs, and charts agree.
// ---------------------------------------------------------------------------

export function formatValue(value: any, column: SheetColumn): string {
  if (value === null || value === undefined || value === "") return "";

  switch (column.type) {
    case "text":
    case "long_text":
      return String(value);
    case "number": {
      const n = Number(value);
      if (!Number.isFinite(n)) return String(value);
      const decimals = column.config.decimals ?? 0;
      const sep = column.config.thousand_sep !== false;
      const formatted = n.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        useGrouping: sep,
      });
      return `${column.config.prefix ?? ""}${formatted}${column.config.suffix ?? ""}`;
    }
    case "currency": {
      const n = Number(value);
      if (!Number.isFinite(n)) return String(value);
      const decimals = column.config.decimals ?? 0;
      const cur = column.config.currency ?? "USD";
      const symbol: Record<string, string> = {
        USD: "$", ARS: "AR$", BRL: "R$", CLP: "CLP$",
        MXN: "Mex$", COP: "COP$", EUR: "€",
      };
      const sym = symbol[cur] ?? `${cur} `;
      const formatted = n.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
      return `${sym}${formatted}`;
    }
    case "percent": {
      const n = Number(value);
      if (!Number.isFinite(n)) return String(value);
      const decimals = column.config.decimals ?? 1;
      // Stored as 0..1 by convention. If looks like 0..100, show as-is.
      const pct = Math.abs(n) <= 1.0001 ? n * 100 : n;
      return `${pct.toFixed(decimals)}%`;
    }
    case "date": {
      const s = String(value);
      const d = new Date(s);
      if (isNaN(d.getTime())) return s;
      const fmt = column.config.format ?? "yyyy-mm-dd";
      if (fmt === "MMM yyyy") {
        return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      }
      if (fmt === "d MMM") {
        return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
      }
      return d.toISOString().slice(0, 10);
    }
    case "single_select": {
      const opt = (column.config.options ?? []).find((o) => o.id === value || o.label === value);
      return opt?.label ?? String(value);
    }
    case "checkbox":
      return value ? "✓" : "";
    case "attachment_url":
      return String(value);
  }
}

/** Coerce a raw input string to the storage type for a column. */
export function parseCellInput(raw: string, column: SheetColumn): any {
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  switch (column.type) {
    case "text":
    case "long_text":
    case "single_select":
    case "attachment_url":
      return trimmed;
    case "number":
    case "currency": {
      const cleaned = trimmed.replace(/[$,\s]/g, "").replace(/^[A-Za-z€]+/, "");
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : null;
    }
    case "percent": {
      const cleaned = trimmed.replace(/[%\s]/g, "");
      const n = Number(cleaned);
      if (!Number.isFinite(n)) return null;
      // Accept "42" as 42% (store as 0.42) or "0.42" as 0.42.
      return Math.abs(n) > 1.0001 ? n / 100 : n;
    }
    case "date":
      return trimmed; // ISO yyyy-mm-dd from <input type="date">
    case "checkbox":
      return trimmed === "true" || trimmed === "1";
  }
}
