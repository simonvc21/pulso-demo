"use client";

// L.6c — When the GP arrives at /forms/[slug]/edit?from=create, smooth-scroll
// to the Schedule editor after a brief pause so they immediately see step 2.

import { useEffect } from "react";

export function ScrollToSchedule() {
  useEffect(() => {
    const t = setTimeout(() => {
      const el = document.getElementById("schedule");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 600);
    return () => clearTimeout(t);
  }, []);
  return null;
}
