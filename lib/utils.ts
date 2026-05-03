import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtUSD(n: number, opts: { compact?: boolean } = {}) {
  if (opts.compact) {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n}`;
  }
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

// L.7 — currency-aware formatter. Drop-in replacement for fmtUSD when the
// caller knows the org currency. Falls back to USD shape when the currency
// code isn't recognized. All amounts are stored as USD in the DB; this is a
// display-only helper for funds tracking in BRL/MXN/COP/etc.
const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$",
  BRL: "R$",
  MXN: "Mex$",
  COP: "COP$",
  CLP: "CLP$",
  ARS: "AR$",
  PEN: "S/",
  EUR: "€",
  GBP: "£",
};

export function fmtMoney(
  n: number,
  opts: { compact?: boolean } = {},
  currency: string | null | undefined = "USD",
) {
  const code = (currency ?? "USD").toUpperCase();
  const symbol = CURRENCY_SYMBOL[code] ?? "$";
  if (opts.compact) {
    if (Math.abs(n) >= 1_000_000) return `${symbol}${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `${symbol}${(n / 1_000).toFixed(0)}K`;
    return `${symbol}${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
  try {
    return n.toLocaleString("en-US", { style: "currency", currency: code, maximumFractionDigits: 0 });
  } catch {
    // Unknown ISO code → fall back to symbol + grouped digits.
    return `${symbol}${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
}

export function fmtPct(n: number, decimals = 0) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(decimals)}%`;
}

export function fmtNum(n: number) {
  return n.toLocaleString("en-US");
}
