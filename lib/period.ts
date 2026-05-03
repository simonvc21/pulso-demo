// L.12 — Period helpers. Single source of truth for sorting, formatting, and
// parsing periods now that metrics are stored as (year, month, kind) instead
// of a "Q1 2026" string. Client-safe: no Supabase imports.

export type PeriodKind = "month" | "quarter" | "annual";
export type TrackingCadence = "monthly" | "quarterly" | "annual";

export interface Period {
  year: number;
  month: number; // 1..12; for quarterly = quarter-end month (3/6/9/12); for annual = 12
  kind: PeriodKind;
}

/** Comparable integer key for sort. Same year/month with different kind sorts
 *  monthly < quarterly < annual so a mixed list shows finest grain first. */
export function periodKey(p: Pick<Period, "year" | "month" | "kind">): number {
  const k = p.kind === "month" ? 0 : p.kind === "quarter" ? 1 : 2;
  return p.year * 1000 + p.month * 10 + k;
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Human-friendly label: "Jan 2026", "Q1 2026", "FY 2026". */
export function formatPeriod(p: Pick<Period, "year" | "month" | "kind">): string {
  if (p.kind === "month") return `${MONTH_SHORT[p.month - 1]} ${p.year}`;
  if (p.kind === "quarter") {
    const q = Math.ceil(p.month / 3);
    return `Q${q} ${p.year}`;
  }
  return `FY ${p.year}`;
}

/** Parse a user-typed period string. Accepts:
 *    - "Jan 2026" / "January 2026"
 *    - "2026-01" / "01/2026"
 *    - "Q1 2026" / "Q1-2026" / "2026 Q1"
 *    - "FY 2026" / "2026"
 *  Returns null if unrecognized. The cadence param picks how a single year
 *  ("2026") gets interpreted — defaults to annual. */
export function parsePeriod(input: string, defaultKind: PeriodKind = "month"): Period | null {
  const t = input.trim();
  if (!t) return null;

  // Quarter forms
  let m = /^Q([1-4])\s+(\d{4})$/i.exec(t)
       || /^Q([1-4])[-_/](\d{4})$/i.exec(t)
       || /^(\d{4})\s*Q([1-4])$/i.exec(t)
       || /^(\d{4})-Q([1-4])$/i.exec(t);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const [q, y] = a <= 4 ? [a, b] : [b, a];
    return { year: y, month: q * 3, kind: "quarter" };
  }

  // Annual forms (FY 2026 / 2026)
  m = /^(?:FY|fy)\s*(\d{4})$/i.exec(t);
  if (m) return { year: parseInt(m[1], 10), month: 12, kind: "annual" };
  if (/^\d{4}$/.test(t)) return { year: parseInt(t, 10), month: 12, kind: defaultKind === "month" ? "annual" : defaultKind };

  // Month name forms
  const monthNames = [
    "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
    "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
  ];
  const lower = t.toLowerCase();
  for (let i = 0; i < monthNames.length; i++) {
    const name = monthNames[i];
    const idx = (i % 12) + 1;
    if (lower.startsWith(name)) {
      const yearMatch = /(\d{4})/.exec(lower.slice(name.length));
      if (yearMatch) return { year: parseInt(yearMatch[1], 10), month: idx, kind: "month" };
    }
  }

  // Numeric month forms: 2026-01, 01/2026, 2026/01
  m = /^(\d{4})[-/](\d{1,2})$/.exec(t);
  if (m) return { year: parseInt(m[1], 10), month: clampMonth(parseInt(m[2], 10)), kind: "month" };
  m = /^(\d{1,2})[-/](\d{4})$/.exec(t);
  if (m) return { year: parseInt(m[2], 10), month: clampMonth(parseInt(m[1], 10)), kind: "month" };

  return null;
}

function clampMonth(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(12, n));
}

/** Generate the last N periods at a cadence, ending at "today" UTC.
 *  Example: lastNPeriods("monthly", 12) = [Dec 2025, Nov 2025, ..., Jan 2026]
 *  in chronological order (oldest → newest). */
export function lastNPeriods(cadence: TrackingCadence, n: number, fromIso?: string): Period[] {
  const now = fromIso ? new Date(fromIso) : new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1; // 1..12

  const out: Period[] = [];
  if (cadence === "monthly") {
    for (let i = n - 1; i >= 0; i--) {
      const totalMonths = y * 12 + (m - 1) - i;
      const yy = Math.floor(totalMonths / 12);
      const mm = (totalMonths % 12) + 1;
      out.push({ year: yy, month: mm, kind: "month" });
    }
  } else if (cadence === "quarterly") {
    const currentQ = Math.ceil(m / 3);
    for (let i = n - 1; i >= 0; i--) {
      const totalQ = y * 4 + (currentQ - 1) - i;
      const yy = Math.floor(totalQ / 4);
      const qq = (totalQ % 4) + 1;
      out.push({ year: yy, month: qq * 3, kind: "quarter" });
    }
  } else {
    for (let i = n - 1; i >= 0; i--) {
      out.push({ year: y - i, month: 12, kind: "annual" });
    }
  }
  return out;
}

/** Stable string id for a period, useful as a React key or map key. */
export function periodId(p: Pick<Period, "year" | "month" | "kind">): string {
  return `${p.year}-${String(p.month).padStart(2, "0")}-${p.kind}`;
}

/** Number of periods to render in /data + chart history by default. */
export function defaultHistoryLength(cadence: TrackingCadence): number {
  if (cadence === "monthly") return 24;     // 2 years
  if (cadence === "quarterly") return 8;    // 2 years
  return 5;                                 // 5 years
}

/** Compatibility shim — derives (year, month, kind) from a legacy "Q1 2026"
 *  or new "Jan 2026" / "M03 2026" string. Used in writes to populate the
 *  new period_* columns alongside the still-present `quarter` text column.
 *  Returns nulls if the string isn't recognized. */
export function periodColumnsFromQuarterString(
  s: string,
): { period_year: number | null; period_month: number | null; period_kind: PeriodKind } {
  const t = (s ?? "").trim();
  // Q1 2026
  let m = /^Q([1-4])\s+(\d{4})$/i.exec(t);
  if (m) {
    return { period_year: parseInt(m[2], 10), period_month: parseInt(m[1], 10) * 3, period_kind: "quarter" };
  }
  // M03 2026 (synthetic monthly from backfill)
  m = /^M(\d{2})\s+(\d{4})$/i.exec(t);
  if (m) {
    return { period_year: parseInt(m[2], 10), period_month: parseInt(m[1], 10), period_kind: "month" };
  }
  // Jan 2026 / Feb 2026 ...
  const p = parsePeriod(t);
  if (p) return { period_year: p.year, period_month: p.month, period_kind: p.kind };
  return { period_year: null, period_month: null, period_kind: "month" };
}

/** Inverse of periodColumnsFromQuarterString — turns a period back into the
 *  pseudo-key string used by the legacy `quarter` column. Always returns a
 *  unique-per-period string so the existing UNIQUE(company_id, quarter)
 *  constraint remains satisfied during the transition. */
export function quarterStringFromPeriod(p: Pick<Period, "year" | "month" | "kind">): string {
  if (p.kind === "quarter") {
    const q = Math.ceil(p.month / 3);
    return `Q${q} ${p.year}`;
  }
  if (p.kind === "annual") return `FY ${p.year}`;
  // month
  return `M${String(p.month).padStart(2, "0")} ${p.year}`;
}
