// Lightweight i18n helper. Cookie-driven, no next-intl runtime.
//
// IMPORTANT: this module is imported from BOTH server components and
// client-imported chains (Topbar is used inside form-builder which is "use client").
// So we cannot import "next/headers" at the top level. Server callers can
// pass an explicit `locale`; everything else falls back to the default.

export type Locale = "en" | "es";
export const LOCALES: Locale[] = ["en", "es"];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "pulso_locale";

import enJson from "@/messages/en.json";
import esJson from "@/messages/es.json";

type Messages = Record<string, any>;

const dictionaries: Record<Locale, Messages> = {
  en: enJson as Messages,
  es: esJson as Messages,
};

export function getDictionary(locale: Locale = DEFAULT_LOCALE): Messages {
  return dictionaries[locale] ?? dictionaries.en;
}

export function t(
  key: string,
  locale: Locale = DEFAULT_LOCALE,
  vars?: Record<string, string | number>,
): string {
  const dict = getDictionary(locale);
  const parts = key.split(".");
  let cur: any = dict;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in cur) {
      cur = cur[p];
    } else {
      return key;
    }
  }
  if (typeof cur !== "string") return key;
  if (!vars) return cur;
  return cur.replace(/\{\{(\w+)\}\}/g, (_, name) =>
    name in vars ? String(vars[name]) : `{{${name}}}`
  );
}
