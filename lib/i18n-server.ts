import "server-only";
import { cookies } from "next/headers";
import { type Locale, DEFAULT_LOCALE, LOCALE_COOKIE, getDictionary as baseGetDict, t as baseT } from "@/lib/i18n";

export function getServerLocale(): Locale {
  try {
    const v = cookies().get(LOCALE_COOKIE)?.value;
    if (v === "es") return "es";
    if (v === "en") return "en";
  } catch {
    // not in a request scope
  }
  return DEFAULT_LOCALE;
}

export function getServerDictionary() {
  return baseGetDict(getServerLocale());
}

export function ts(key: string): string {
  return baseT(key, getServerLocale());
}
